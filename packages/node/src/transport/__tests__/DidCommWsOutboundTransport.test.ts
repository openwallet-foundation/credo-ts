import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import type { Socket } from 'node:net'
import { createServer as createNetServer } from 'node:net'
import type { AgentContext, AgentDependencies } from '@credo-ts/core'
import { CredoError, EventEmitter } from '@credo-ts/core'
import type { DidCommOutboundWebSocketClosedEvent, DidCommOutboundWebSocketOpenedEvent } from '@credo-ts/didcomm'
import { DidCommTransportEventTypes, DidCommWsOutboundTransport } from '@credo-ts/didcomm'
import { Subject } from 'rxjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WebSocket, { WebSocketServer } from 'ws'

import { agentDependencies } from '../../index'

const cleanup: Array<() => Promise<void>> = []

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((fn) => fn()))
})

function createAgentContext(dependencies: AgentDependencies = agentDependencies) {
  const eventEmitter = new EventEmitter(dependencies, new Subject())

  return {
    config: {
      logger: { debug: vi.fn(), error: vi.fn(), trace: vi.fn() },
      agentDependencies: dependencies,
    },
    dependencyManager: { resolve: vi.fn(() => eventEmitter) },
  } as unknown as AgentContext
}

async function startServer() {
  const socketServer = new WebSocketServer({ noServer: true })
  const publicServer = createServer()
  publicServer.on('upgrade', (request, socket, head) => {
    socketServer.handleUpgrade(request, socket, head, (webSocket) => {
      socketServer.emit('connection', webSocket, request)
    })
  })

  await new Promise<void>((resolve) => publicServer.listen(0, resolve))
  const address = publicServer.address()
  if (!address || typeof address === 'string') {
    throw new Error('Server did not bind to a TCP port')
  }

  const serverSockets: WebSocket[] = []
  socketServer.on('connection', (webSocket) => serverSockets.push(webSocket))

  cleanup.push(async () => {
    for (const socket of serverSockets) socket.terminate()
    socketServer.close()
    await new Promise<void>((resolve, reject) => publicServer.close((error) => (error ? reject(error) : resolve())))
  })

  return { endpoint: `ws://127.0.0.1:${address.port}`, serverSockets }
}

/**
 * A peer that completes the WebSocket handshake and then ignores every frame, including the close frame,
 * like an agent behind a NAT or proxy that silently dropped the idle connection
 */
async function startSilentServer({ holdHandshakes = false } = {}) {
  const peerSockets: Socket[] = []
  const peerSocketsClosed: Array<Promise<void>> = []
  const heldHandshakes: Array<() => void> = []
  const receivedFrames: Uint8Array[] = []

  const server = createNetServer((socket) => {
    peerSockets.push(socket)
    peerSocketsClosed.push(new Promise((resolve) => socket.once('close', () => resolve())))
    socket.on('error', () => {})

    let request = ''
    let upgraded = false
    socket.on('data', (chunk) => {
      if (upgraded) {
        receivedFrames.push(chunk)
        return
      }

      request += chunk.toString('latin1')
      if (!request.includes('\r\n\r\n')) return

      const key = /^sec-websocket-key:\s*(.+)$/im.exec(request)?.[1].trim()
      const accept = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64')
      const completeHandshake = () =>
        socket.write(
          [
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${accept}`,
            '',
            '',
          ].join('\r\n')
        )
      upgraded = true

      if (holdHandshakes) heldHandshakes.push(completeHandshake)
      else completeHandshake()
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Server did not bind to a TCP port')
  }

  cleanup.push(async () => {
    for (const socket of peerSockets) socket.destroy()
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  })

  const releaseHandshakes = () => {
    for (const completeHandshake of heldHandshakes.splice(0)) completeHandshake()
  }

  return {
    endpoint: `ws://127.0.0.1:${address.port}`,
    peerSockets,
    peerSocketsClosed,
    heldHandshakes,
    releaseHandshakes,
    receivedFrames,
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), ms)
    }),
  ]).finally(() => clearTimeout(timeout))
}

function collectClosedEvents(agentContext: AgentContext) {
  const closedEvents: Array<DidCommOutboundWebSocketClosedEvent['payload']> = []
  agentContext.dependencyManager
    .resolve(EventEmitter)
    .observable<DidCommOutboundWebSocketClosedEvent>(DidCommTransportEventTypes.DidCommOutboundWebSocketClosedEvent)
    .subscribe((e) => closedEvents.push(e.payload))

  return closedEvents
}

function collectOpenedEvents(agentContext: AgentContext) {
  const openedEvents: Array<DidCommOutboundWebSocketOpenedEvent['payload']> = []
  agentContext.dependencyManager
    .resolve(EventEmitter)
    .observable<DidCommOutboundWebSocketOpenedEvent>(DidCommTransportEventTypes.DidCommOutboundWebSocketOpenedEvent)
    .subscribe((e) => openedEvents.push(e.payload))

  return openedEvents
}

function addThrowingClosedListener(agentContext: AgentContext, error: Error, connectionId?: string) {
  // A listener registered with on() is called synchronously, so its error reaches the transport
  const listener = vi.fn((event: DidCommOutboundWebSocketClosedEvent) => {
    if (!connectionId || event.payload.connectionId === connectionId) throw error
  })
  agentContext.dependencyManager
    .resolve(EventEmitter)
    .on<DidCommOutboundWebSocketClosedEvent>(DidCommTransportEventTypes.DidCommOutboundWebSocketClosedEvent, listener)

  return listener
}

async function timeStop(transport: DidCommWsOutboundTransport) {
  const startedAt = performance.now()
  await transport.stop()
  return performance.now() - startedAt
}

async function startTransport(agentContext = createAgentContext()) {
  const transport = new DidCommWsOutboundTransport()
  await transport.start(agentContext)
  cleanup.push(() => transport.stop())

  return transport
}

async function waitForSockets(serverSockets: WebSocket[], count: number) {
  for (let i = 0; i < 100 && serverSockets.length < count; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

async function waitUntil(condition: () => boolean, ms: number, message: string) {
  const startedAt = performance.now()
  while (!condition()) {
    if (performance.now() - startedAt > ms) throw new Error(message)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

/**
 * Like the React Native WebSocket: no terminate(), and the close event never arrives after close().
 * Unless `opens` is true, the connection fails with a close event and no error event.
 */
function createAgentContextWithoutTerminate({ opens = true } = {}) {
  const sockets: FakeWebSocket[] = []

  class FakeWebSocket {
    public static readonly CONNECTING = 0
    public static readonly OPEN = 1
    public static readonly CLOSING = 2
    public static readonly CLOSED = 3

    public readyState = FakeWebSocket.CONNECTING
    public onopen: (() => void) | null = null
    public onerror: ((error: unknown) => void) | null = null
    public onclose: ((event: { code: number; reason: string }) => void) | null = null
    public send = vi.fn()
    public close = vi.fn(() => {
      this.readyState = FakeWebSocket.CLOSING
    })
    public addEventListener = vi.fn()
    public removeEventListener = vi.fn()

    public constructor(public readonly url: string) {
      sockets.push(this)
      setTimeout(() => {
        if (opens) {
          this.readyState = FakeWebSocket.OPEN
          this.onopen?.()
        } else {
          this.readyState = FakeWebSocket.CLOSED
          this.onclose?.({ code: 1006, reason: '' })
        }
      }, 0)
    }
  }

  const agentContext = createAgentContext({
    ...agentDependencies,
    WebSocketClass: FakeWebSocket as unknown as AgentDependencies['WebSocketClass'],
  })

  return { agentContext, sockets }
}

const payload = { protected: 'protected', iv: 'iv', ciphertext: 'ciphertext', tag: 'tag' }

describe('DidCommWsOutboundTransport', () => {
  it('does not reuse a socket that was opened for a message without return routing', async () => {
    const { endpoint, serverSockets } = await startServer()
    const transport = await startTransport()

    await transport.sendMessage({ payload, endpoint, connectionId: 'connection-id', responseRequested: false })
    await transport.sendMessage({ payload, endpoint, connectionId: 'connection-id', responseRequested: true })
    await waitForSockets(serverSockets, 2)

    expect(serverSockets).toHaveLength(2)
    expect(serverSockets[0].readyState).not.toBe(WebSocket.OPEN)
    expect(serverSockets[1].readyState).toBe(WebSocket.OPEN)
  })

  it('reuses a socket opened with return routing for a message without return routing', async () => {
    const { endpoint, serverSockets } = await startServer()
    const transport = await startTransport()

    await transport.sendMessage({ payload, endpoint, connectionId: 'connection-id', responseRequested: true })
    await transport.sendMessage({ payload, endpoint, connectionId: 'connection-id', responseRequested: false })
    await waitForSockets(serverSockets, 1)

    expect(serverSockets).toHaveLength(1)
    expect(serverSockets[0].readyState).toBe(WebSocket.OPEN)
  })

  it('opens a new socket when the other agent closed the previous one', async () => {
    const { endpoint, serverSockets } = await startServer()
    const transport = await startTransport()

    await transport.sendMessage({ payload, endpoint, connectionId: 'connection-id', responseRequested: true })
    await waitForSockets(serverSockets, 1)

    const closed = new Promise<void>((resolve) => serverSockets[0].once('close', () => resolve()))
    serverSockets[0].close()
    await closed

    await expect(
      transport.sendMessage({ payload, endpoint, connectionId: 'connection-id', responseRequested: true })
    ).resolves.toBeUndefined()
    await waitForSockets(serverSockets, 2)

    expect(serverSockets).toHaveLength(2)
    expect(serverSockets[1].readyState).toBe(WebSocket.OPEN)
  })

  it('forgets the sockets of a connection at once and emits their closed event only once', async () => {
    const { endpoint, serverSockets } = await startServer()
    const agentContext = createAgentContext()
    const transport = await startTransport(agentContext)

    await transport.sendMessage({ payload, endpoint, connectionId: 'connection-a', responseRequested: true })
    await transport.sendMessage({ payload, endpoint, connectionId: 'connection-b', responseRequested: true })
    await waitForSockets(serverSockets, 2)

    const closedEvents: string[] = []
    agentContext.dependencyManager
      .resolve(EventEmitter)
      .observable<DidCommOutboundWebSocketClosedEvent>(DidCommTransportEventTypes.DidCommOutboundWebSocketClosedEvent)
      .subscribe((e) => closedEvents.push(e.payload.connectionId ?? ''))
    const serverCloseCode = new Promise<number>((resolve) => serverSockets[0].once('close', resolve))

    expect(transport.closeSocketByConnectionId('connection-a')).toBe(true)
    expect(transport.closeSocketByConnectionId('connection-c')).toBe(false)
    expect(closedEvents).toEqual(['connection-a'])

    // 1006 means the socket was terminated instead of waiting for a close handshake
    expect(await serverCloseCode).toBe(1006)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(closedEvents).toEqual(['connection-a'])
    expect(serverSockets[1].readyState).toBe(WebSocket.OPEN)
  })

  it('closes the sockets of a connection only when the connection id matches exactly', async () => {
    const { endpoint, serverSockets } = await startServer()
    const agentContext = createAgentContext()
    const transport = await startTransport(agentContext)

    await transport.sendMessage({ payload, endpoint, connectionId: 'a', responseRequested: true })
    await transport.sendMessage({ payload, endpoint, connectionId: 'b-a', responseRequested: true })
    await waitForSockets(serverSockets, 2)

    const closedEvents = collectClosedEvents(agentContext)
    const serverClosed = new Promise<void>((resolve) => serverSockets[0].once('close', () => resolve()))

    // The socket id of 'b-a' also ends with '-a'
    expect(transport.closeSocketByConnectionId('a')).toBe(true)
    expect(closedEvents).toEqual([{ socketId: `${endpoint}-a`, connectionId: 'a' }])
    await withTimeout(serverClosed, 1000, 'The server socket was not closed')
    expect(serverSockets[1].readyState).toBe(WebSocket.OPEN)
  })

  it('closes every socket of a connection even if a closed event listener throws', async () => {
    const first = await startSilentServer()
    const second = await startSilentServer()
    const agentContext = createAgentContext()
    const transport = await startTransport(agentContext)

    // The same connection over two endpoints has two sockets
    await transport.sendMessage({
      payload,
      endpoint: first.endpoint,
      connectionId: 'connection-id',
      responseRequested: true,
    })
    await transport.sendMessage({
      payload,
      endpoint: second.endpoint,
      connectionId: 'connection-id',
      responseRequested: true,
    })

    const listenerError = new Error('listener failed')
    const listener = addThrowingClosedListener(agentContext, listenerError)

    expect(transport.closeSocketByConnectionId('connection-id')).toBe(true)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(agentContext.config.logger.error).toHaveBeenCalledTimes(2)
    expect(agentContext.config.logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ error: listenerError })
    )
    await withTimeout(
      Promise.all([...first.peerSocketsClosed, ...second.peerSocketsClosed]),
      1000,
      'The peer sockets were not closed'
    )

    // Both sockets were forgotten
    expect(transport.closeSocketByConnectionId('connection-id')).toBe(false)
  })

  it('rejects the send when the socket closes before it opened', async () => {
    const { agentContext, sockets } = createAgentContextWithoutTerminate({ opens: false })
    const transport = await startTransport(agentContext)
    const endpoint = 'ws://agent.example'

    const error = await withTimeout(
      transport.sendMessage({ payload, endpoint, connectionId: 'connection-id', responseRequested: true }).then(
        () => undefined,
        (error: unknown) => error
      ),
      1000,
      'The send did not settle'
    )

    expect(error).toBeInstanceOf(CredoError)
    expect((error as CredoError).message).toContain('closed before it opened')
    expect(sockets[0].send).not.toHaveBeenCalled()
    expect(agentContext.config.logger.debug).toHaveBeenCalledWith(`WebSocket to ${endpoint} closed`, {
      code: 1006,
      reason: '',
      opened: false,
      lifetimeMs: undefined,
    })
  })

  it('logs the close code, reason and lifetime of a socket the peer closed', async () => {
    const { endpoint, serverSockets } = await startServer()
    const agentContext = createAgentContext()
    const transport = await startTransport(agentContext)
    const closedEvents = collectClosedEvents(agentContext)

    await expect(
      transport.sendMessage({ payload, endpoint, connectionId: 'connection-id', responseRequested: true })
    ).resolves.toBeUndefined()
    await waitForSockets(serverSockets, 1)

    serverSockets[0].close(4000, 'bye')
    await waitUntil(() => closedEvents.length > 0, 1000, 'The closed event was not emitted')

    expect(closedEvents).toEqual([{ socketId: `${endpoint}-connection-id`, connectionId: 'connection-id' }])
    expect(agentContext.config.logger.debug).toHaveBeenCalledWith(`WebSocket to ${endpoint} closed`, {
      code: 4000,
      reason: 'bye',
      opened: true,
      lifetimeMs: expect.any(Number),
    })
    expect(agentContext.config.logger.error).not.toHaveBeenCalled()
  })

  describe('stop', () => {
    it('closes a socket that finished connecting after it was stopped', async () => {
      const { endpoint, peerSocketsClosed, heldHandshakes, releaseHandshakes, receivedFrames } =
        await startSilentServer({ holdHandshakes: true })
      const agentContext = createAgentContext()
      const transport = await startTransport(agentContext)
      const openedEvents = collectOpenedEvents(agentContext)
      const closedEvents = collectClosedEvents(agentContext)

      const sending = transport.sendMessage({
        payload,
        endpoint,
        connectionId: 'connection-id',
        responseRequested: true,
      })
      const sendError = sending.then(
        () => undefined,
        (error: unknown) => error
      )
      await waitUntil(() => heldHandshakes.length === 1, 1000, 'The handshake was not requested')

      expect(await timeStop(transport)).toBeLessThan(1000)
      expect(closedEvents).toEqual([])
      releaseHandshakes()

      const error = await withTimeout(sendError, 1000, 'The send did not settle')
      expect(error).toBeInstanceOf(CredoError)
      expect((error as CredoError).message).toContain('Outbound transport is not active')
      await withTimeout(Promise.all(peerSocketsClosed), 1000, 'The peer socket was not closed')
      expect(closedEvents).toEqual([{ socketId: `${endpoint}-connection-id`, connectionId: 'connection-id' }])

      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(closedEvents).toHaveLength(1)
      // The closed event pairs the opened event that was emitted when the socket connected
      expect(openedEvents).toEqual([{ socketId: `${endpoint}-connection-id`, connectionId: 'connection-id' }])
      // The socket was never stored, and nothing was sent on it
      expect(transport.closeSocketByConnectionId('connection-id')).toBe(false)
      expect(receivedFrames).toEqual([])
    })

    it('does not wait for the close handshake of a peer that went away silently', async () => {
      const { endpoint, peerSockets, peerSocketsClosed } = await startSilentServer()
      const agentContext = createAgentContext()
      const transport = await startTransport(agentContext)

      await transport.sendMessage({ payload, endpoint, connectionId: 'connection-a', responseRequested: true })
      await transport.sendMessage({ payload, endpoint, connectionId: 'connection-b', responseRequested: true })
      expect(peerSockets).toHaveLength(2)

      const closedEvents = collectClosedEvents(agentContext)

      // Waiting for the close handshake takes 30 s with Node ws
      expect(await timeStop(transport)).toBeLessThan(1000)
      expect(closedEvents).toEqual([
        { socketId: `${endpoint}-connection-a`, connectionId: 'connection-a' },
        { socketId: `${endpoint}-connection-b`, connectionId: 'connection-b' },
      ])

      // The sockets are terminated, not left waiting for the peer
      await withTimeout(Promise.all(peerSocketsClosed), 1000, 'The peer sockets were not closed')

      // The socket's own close handler doesn't emit the closed event a second time
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(closedEvents).toHaveLength(2)
    })

    it('closes every socket and resolves even if a closed event listener throws', async () => {
      const { endpoint, peerSockets, peerSocketsClosed } = await startSilentServer()
      const agentContext = createAgentContext()
      const transport = await startTransport(agentContext)

      await transport.sendMessage({ payload, endpoint, connectionId: 'connection-a', responseRequested: true })
      await transport.sendMessage({ payload, endpoint, connectionId: 'connection-b', responseRequested: true })
      expect(peerSockets).toHaveLength(2)

      const listenerError = new Error('listener failed')
      const listener = addThrowingClosedListener(agentContext, listenerError, 'connection-a')

      await expect(transport.stop()).resolves.toBeUndefined()
      expect(listener.mock.calls.map(([event]) => event.payload.connectionId)).toEqual(['connection-a', 'connection-b'])
      expect(agentContext.config.logger.error).toHaveBeenCalledTimes(1)
      expect(agentContext.config.logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: listenerError, connectionId: 'connection-a' })
      )
      await withTimeout(Promise.all(peerSocketsClosed), 1000, 'The peer sockets were not closed')

      // Both sockets were forgotten, so stopping again emits nothing
      await expect(transport.stop()).resolves.toBeUndefined()
      expect(listener).toHaveBeenCalledTimes(2)
    })

    it('still emits the closed event of every socket when closing a socket throws', async () => {
      const { endpoint } = await startSilentServer()
      const agentContext = createAgentContext()
      const transport = await startTransport(agentContext)

      await transport.sendMessage({ payload, endpoint, connectionId: 'connection-a', responseRequested: true })
      await transport.sendMessage({ payload, endpoint, connectionId: 'connection-b', responseRequested: true })

      const closeError = new Error('close failed')
      const terminate = vi.spyOn(WebSocket.prototype, 'terminate').mockImplementationOnce(() => {
        throw closeError
      })
      cleanup.push(async () => terminate.mockRestore())
      const closedEvents = collectClosedEvents(agentContext)

      await expect(transport.stop()).resolves.toBeUndefined()
      expect(terminate).toHaveBeenCalledTimes(2)
      expect(closedEvents.map(({ connectionId }) => connectionId)).toEqual(['connection-a', 'connection-b'])
      expect(agentContext.config.logger.error).toHaveBeenCalledTimes(1)
      expect(agentContext.config.logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: closeError, connectionId: 'connection-a' })
      )

      // The socket that failed to close was forgotten too, so stopping again emits nothing
      await transport.stop()
      expect(closedEvents).toHaveLength(2)
    })

    it('terminates the sockets instead of starting a close handshake', async () => {
      const { endpoint, serverSockets } = await startServer()
      const transport = await startTransport()

      await transport.sendMessage({ payload, endpoint, connectionId: 'connection-id', responseRequested: true })
      await waitForSockets(serverSockets, 1)
      const serverCloseCode = new Promise<number>((resolve) => serverSockets[0].once('close', resolve))

      await transport.stop()

      // 1006 means the socket was terminated instead of closed with a close handshake
      expect(await withTimeout(serverCloseCode, 1000, 'The server socket was not closed')).toBe(1006)
    })

    it('does not wait for a socket that is already closing', async () => {
      const { endpoint, peerSockets, peerSocketsClosed } = await startSilentServer()
      const agentContext = createAgentContext()
      const transport = await startTransport(agentContext)

      // Without return routing the socket is closed after the send, and stays closing as the peer never answers
      await transport.sendMessage({ payload, endpoint, connectionId: 'connection-id', responseRequested: false })
      expect(peerSockets).toHaveLength(1)

      const closedEvents = collectClosedEvents(agentContext)

      expect(await timeStop(transport)).toBeLessThan(1000)
      await withTimeout(Promise.all(peerSocketsClosed), 1000, 'The peer socket was not closed')

      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(closedEvents).toEqual([{ socketId: `${endpoint}-connection-id`, connectionId: 'connection-id' }])
    })

    it('closes the sockets without waiting when the WebSocket implementation cannot terminate them', async () => {
      const { agentContext, sockets } = createAgentContextWithoutTerminate()
      const transport = await startTransport(agentContext)
      const endpoint = 'ws://agent.example'

      await transport.sendMessage({ payload, endpoint, connectionId: 'connection-id', responseRequested: true })
      expect(sockets).toHaveLength(1)
      expect(sockets[0].close).not.toHaveBeenCalled()

      const closedEvents = collectClosedEvents(agentContext)

      expect(await timeStop(transport)).toBeLessThan(1000)
      expect(sockets[0].close).toHaveBeenCalledTimes(1)
      expect(sockets[0].onclose).toBeNull()
      expect(closedEvents).toEqual([{ socketId: `${endpoint}-connection-id`, connectionId: 'connection-id' }])
    })

    it('still emits the closed event of every socket when close() throws on an implementation without terminate()', async () => {
      const { agentContext, sockets } = createAgentContextWithoutTerminate()
      const transport = await startTransport(agentContext)
      const endpoint = 'ws://agent.example'

      await transport.sendMessage({ payload, endpoint, connectionId: 'connection-a', responseRequested: true })
      await transport.sendMessage({ payload, endpoint, connectionId: 'connection-b', responseRequested: true })
      expect(sockets).toHaveLength(2)

      const closeError = new Error('close failed')
      sockets[0].close.mockImplementationOnce(() => {
        throw closeError
      })
      const closedEvents = collectClosedEvents(agentContext)

      await expect(transport.stop()).resolves.toBeUndefined()
      expect(sockets[1].close).toHaveBeenCalledTimes(1)
      expect(closedEvents.map(({ connectionId }) => connectionId)).toEqual(['connection-a', 'connection-b'])
      expect(agentContext.config.logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: closeError, connectionId: 'connection-a' })
      )

      // The socket that failed to close was forgotten too, so stopping again emits nothing
      await transport.stop()
      expect(closedEvents).toHaveLength(2)
    })

    it('does not send messages after it was stopped', async () => {
      const { endpoint, serverSockets } = await startServer()
      const agentContext = createAgentContext()
      const transport = await startTransport(agentContext)

      await transport.sendMessage({ payload, endpoint, connectionId: 'connection-id', responseRequested: true })
      await waitForSockets(serverSockets, 1)

      const closedEvents = collectClosedEvents(agentContext)
      await transport.stop()

      await expect(
        transport.sendMessage({ payload, endpoint, connectionId: 'connection-id', responseRequested: true })
      ).rejects.toThrow('Outbound transport is not active')

      // The sockets were forgotten, so stopping again doesn't emit their closed event again
      await transport.stop()
      expect(closedEvents).toHaveLength(1)
      expect(serverSockets).toHaveLength(1)
    })
  })
})
