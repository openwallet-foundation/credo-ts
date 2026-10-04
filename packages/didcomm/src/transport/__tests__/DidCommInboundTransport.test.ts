import type { AgentContext } from '@credo-ts/core'
import { EventEmitter, InjectionSymbols } from '@credo-ts/core'
import type { HttpHandler, HttpHandlerHost, HttpRequest } from '@credo-ts/core/http'
import type { WebSocketAcceptor, WebSocketAcceptorHost, WebSocketLike } from '@credo-ts/core/websocket'
import { Subject } from 'rxjs'
import { DidCommEventTypes } from '../../DidCommEvents'
import { DidCommMessageReceiver } from '../../DidCommMessageReceiver'
import { DidCommModule } from '../../DidCommModule'
import { DidCommModuleConfig } from '../../DidCommModuleConfig'
import { DidCommTransportService } from '../../DidCommTransportService'
import { DidCommMimeType } from '../../types'
import { DidCommHttpInboundTransport } from '../DidCommHttpInboundTransport'
import type { DidCommInboundTransport } from '../DidCommInboundTransport'
import type { DidCommOutboundTransport } from '../DidCommOutboundTransport'
import { DidCommWsInboundTransport } from '../DidCommWsInboundTransport'

const encryptedMessage = { protected: 'p', iv: 'i', ciphertext: 'c', tag: 't' }

function createAgentContext({ respond, process = true }: { respond?: boolean; process?: boolean } = {}) {
  const processed = new Subject<unknown>()
  const savedSessions = new Map<string, unknown>()
  const transportService = {
    removeSession: vi.fn((session: { id: string }) => savedSessions.delete(session.id)),
    findSessionById: vi.fn((id: string) => savedSessions.get(id)),
    saveSession: (session: { id: string }) => savedSessions.set(session.id, session),
  }
  const eventEmitter = {
    observable: vi.fn(() => processed.asObservable()),
    // biome-ignore lint/suspicious/noExplicitAny: test double
    emit: vi.fn(async (agentContext: AgentContext, event: any) => {
      if (event.type !== DidCommEventTypes.DidCommMessageReceived) return
      if (respond) await event.payload.session.send(agentContext, event.payload.message)
      if (!process) return
      processed.next({
        type: DidCommEventTypes.DidCommMessageProcessed,
        payload: { encryptedMessage: event.payload.message },
      })
    }),
  }

  const agentContext = {
    config: { logger: { debug: vi.fn(), error: vi.fn() } },
    dependencyManager: {
      resolve: vi.fn((dependency) => {
        if (dependency === DidCommTransportService) return transportService
        if (dependency === DidCommModuleConfig) return { endpoints: [], didCommMimeType: DidCommMimeType.V1 }
        if (dependency === EventEmitter) return eventEmitter
        if (dependency === InjectionSymbols.Stop$) return new Subject<boolean>()
        if (dependency === DidCommMessageReceiver) return { receiveMessage: vi.fn() }
        throw new Error(`Unexpected dependency: ${dependency.name}`)
      }),
    },
  } as unknown as AgentContext

  return { agentContext, eventEmitter, transportService }
}

function createHttpHost() {
  const host = {
    handler: undefined as HttpHandler | undefined,
    attach: vi.fn(async (handler: HttpHandler) => {
      host.handler = handler
    }),
    detach: vi.fn(async (_handler: HttpHandler) => {}),
  } satisfies HttpHandlerHost & { handler?: HttpHandler }
  return host
}

function createWebSocketHost() {
  const host = {
    acceptor: undefined as WebSocketAcceptor | undefined,
    attach: vi.fn(async (acceptor: WebSocketAcceptor) => {
      host.acceptor = acceptor
    }),
    detach: vi.fn(async (_acceptor: WebSocketAcceptor) => {}),
  } satisfies WebSocketAcceptorHost & { acceptor?: WebSocketAcceptor }
  return host
}

async function startHttpTransport(options: { path?: string; respond?: boolean; process?: boolean } = {}) {
  const host = createHttpHost()
  const context = createAgentContext({ respond: options.respond, process: options.process })
  const transport = new DidCommHttpInboundTransport({ host, path: options.path })
  await transport.start(context.agentContext)
  return { ...context, host, transport, handler: transport.handler }
}

function httpRequest(body?: string, contentType: string = DidCommMimeType.V1, path = '/'): HttpRequest {
  return new Request(`https://example.test${path}`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    ...(body === undefined ? {} : { body }),
  })
}

describe('DidCommHttpInboundTransport', () => {
  test('exposes a handler for its path and attaches/detaches it when a host is configured', async () => {
    const { host, transport, handler } = await startHttpTransport({ path: '/didcomm' })

    expect(handler).toMatchObject({
      pathPrefixes: ['/didcomm'],
      maxRequestBodyBytes: 5 * 1024 * 1024,
    })

    await transport.stop()
    expect(host.attach).toHaveBeenCalledWith(handler)
    expect(host.detach).toHaveBeenCalledWith(handler)
  })

  test('defaults the path to / and does not handle other methods or paths', async () => {
    const { handler } = await startHttpTransport()
    expect(handler.pathPrefixes).toEqual(['/'])
    await expect(handler.handle(new Request('https://example.test/other', { method: 'GET' }))).resolves.toBeUndefined()
    await expect(handler.handle(httpRequest(undefined, DidCommMimeType.V1, '/other'))).resolves.toBeUndefined()
  })

  test('rejects unsupported content types with 415', async () => {
    const { handler } = await startHttpTransport()
    const response = await handler.handle(httpRequest('{}', 'application/json'))
    expect(response?.status).toBe(415)
    expect(await response?.text()).toContain(DidCommMimeType.V0)
  })

  test('responds with 200 when the message is processed without a response', async () => {
    const { handler, transportService } = await startHttpTransport()
    const response = await handler.handle(httpRequest(JSON.stringify(encryptedMessage)))

    expect(response?.status).toBe(200)
    expect(response?.body).toBeNull()
    expect(transportService.removeSession).toHaveBeenCalled()
  })

  test('returns the response message using the request content type', async () => {
    const { handler } = await startHttpTransport({ respond: true })
    const response = await handler.handle(httpRequest(JSON.stringify(encryptedMessage), DidCommMimeType.V0))

    expect(response?.status).toBe(200)
    expect(response?.headers.get('content-type')).toBe(`${DidCommMimeType.V0}; charset=utf-8`)
    await expect(response?.json()).resolves.toEqual(encryptedMessage)
  })

  test('responds with 500 when the message cannot be parsed', async () => {
    const { handler } = await startHttpTransport()
    const response = await handler.handle(httpRequest('not json'))
    expect(response?.status).toBe(500)
    await expect(response?.text()).resolves.toBe('Error processing message')
  })

  test('responds with 413 when the request body exceeds its configured limit', async () => {
    const { handler } = await startHttpTransport()
    const response = await handler.handle(
      new Request('https://example.test/', {
        method: 'POST',
        headers: {
          'content-type': DidCommMimeType.V1,
          'content-length': `${5 * 1024 * 1024 + 1}`,
        },
        body: '{}',
      })
    )
    expect(response?.status).toBe(413)
  })

  test('responds with 503 when stopped and can restart on the same handler', async () => {
    const { handler, transport, eventEmitter, agentContext } = await startHttpTransport()
    await transport.stop()

    const stoppedResponse = await handler.handle(httpRequest(JSON.stringify(encryptedMessage)))
    expect(stoppedResponse?.status).toBe(503)
    expect(eventEmitter.emit).not.toHaveBeenCalled()

    await transport.start(agentContext)
    const response = await handler.handle(httpRequest(JSON.stringify(encryptedMessage)))
    expect(response?.status).toBe(200)
  })

  test('responds to in-flight requests and removes their sessions when stopped', async () => {
    const { handler, transport, transportService, agentContext } = await startHttpTransport({ process: false })
    const responsePromise = handler.handle(httpRequest(JSON.stringify(encryptedMessage)))
    await vi.waitFor(() => expect(agentContext.dependencyManager.resolve).toHaveBeenCalledWith(EventEmitter))
    await transport.stop()

    const response = await responsePromise
    expect(response?.status).toBe(200)
    expect(transportService.removeSession).toHaveBeenCalled()
    expect(agentContext.config.logger.error).not.toHaveBeenCalled()
  })

  test('serializes start and stop and attaches only once', async () => {
    const host = createHttpHost()
    const { agentContext } = createAgentContext()
    const transport = new DidCommHttpInboundTransport({ host })

    await Promise.all([transport.start(agentContext), transport.start(agentContext), transport.stop()])
    expect(host.attach).toHaveBeenCalledTimes(1)
    expect(host.detach).toHaveBeenCalledTimes(1)
  })

  test('can restart after the host fails to attach', async () => {
    const host = createHttpHost()
    const { agentContext } = createAgentContext()
    const transport = new DidCommHttpInboundTransport({ host })
    host.attach.mockRejectedValueOnce(new Error('attach failed'))

    await expect(transport.start(agentContext)).rejects.toThrow('attach failed')
    expect((await transport.handler.handle(httpRequest('{}')))?.status).toBe(503)
    await transport.start(agentContext)
    expect(host.attach).toHaveBeenCalledTimes(2)
  })
})

describe('DidCommWsInboundTransport', () => {
  function createSocket() {
    const listeners: Record<string, Array<(event?: unknown) => void>> = {}
    let readyState = 1
    const send = vi.fn()
    const close = vi.fn()
    const socket: WebSocketLike = {
      get readyState() {
        return readyState
      },
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
      send,
      close,
      addEventListener: vi.fn((type: string, listener: (event?: unknown) => void) => {
        listeners[type] = [...(listeners[type] ?? []), listener]
      }),
      removeEventListener: vi.fn(),
    }
    return { socket, listeners, send, close, setReadyState: (state: number) => (readyState = state) }
  }

  test('processes an externally accepted WebSocketLike connection', async () => {
    const { agentContext, eventEmitter } = createAgentContext()
    const transport = new DidCommWsInboundTransport()
    await transport.start(agentContext)

    const { socket, listeners, close } = createSocket()
    transport.acceptor.accept(socket)
    listeners.message[0]({ data: JSON.stringify(encryptedMessage) })
    await vi.waitFor(() => expect(eventEmitter.emit).toHaveBeenCalled())

    await transport.stop()
    expect(close).toHaveBeenCalledTimes(1)
  })

  test('emits messages, closes sockets on stop and removes saved sessions once', async () => {
    const host = createWebSocketHost()
    const { agentContext, eventEmitter, transportService } = createAgentContext()
    const transport = new DidCommWsInboundTransport({ host })
    await transport.start(agentContext)

    const { socket, listeners, close } = createSocket()
    host.acceptor?.accept(socket)
    listeners.message[0]({ data: JSON.stringify(encryptedMessage) })
    await vi.waitFor(() =>
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        agentContext,
        expect.objectContaining({
          type: DidCommEventTypes.DidCommMessageReceived,
          payload: expect.objectContaining({ message: encryptedMessage }),
        })
      )
    )

    const session = eventEmitter.emit.mock.calls[0][1].payload.session
    transportService.saveSession(session)
    await transport.stop()

    expect(close).toHaveBeenCalled()
    expect(host.detach).toHaveBeenCalledWith(host.acceptor)
    expect(transportService.removeSession).toHaveBeenCalledWith(session)
    listeners.close[0]()
    expect(transportService.removeSession).toHaveBeenCalledTimes(1)
  })

  test('removes a saved session when the socket closes', async () => {
    const host = createWebSocketHost()
    const { agentContext, eventEmitter, transportService } = createAgentContext()
    const transport = new DidCommWsInboundTransport({ host })
    await transport.start(agentContext)

    const { socket, listeners } = createSocket()
    host.acceptor?.accept(socket)
    listeners.message[0]({ data: JSON.stringify(encryptedMessage) })
    await vi.waitFor(() => expect(eventEmitter.emit).toHaveBeenCalled())
    const session = eventEmitter.emit.mock.calls[0][1].payload.session
    transportService.saveSession(session)

    listeners.close[0]()
    expect(transportService.removeSession).toHaveBeenCalledWith(session)
  })

  test('does not remove a session that was not saved', async () => {
    const host = createWebSocketHost()
    const { agentContext, transportService } = createAgentContext()
    const transport = new DidCommWsInboundTransport({ host })
    await transport.start(agentContext)

    const { socket, listeners } = createSocket()
    host.acceptor?.accept(socket)
    listeners.close[0]()
    await transport.stop()

    expect(transportService.removeSession).not.toHaveBeenCalled()
  })

  test('accepts Uint8Array message data', async () => {
    const host = createWebSocketHost()
    const { agentContext, eventEmitter } = createAgentContext()
    const transport = new DidCommWsInboundTransport({ host })
    await transport.start(agentContext)

    const { socket, listeners } = createSocket()
    host.acceptor?.accept(socket)
    listeners.message[0]({ data: new TextEncoder().encode(JSON.stringify(encryptedMessage)) })
    await vi.waitFor(() => expect(eventEmitter.emit).toHaveBeenCalled())
  })

  test('closes sockets accepted while stopped or not open', async () => {
    const host = createWebSocketHost()
    const { agentContext } = createAgentContext()
    const transport = new DidCommWsInboundTransport({ host })
    await transport.start(agentContext)
    const acceptor = host.acceptor as WebSocketAcceptor

    const closing = createSocket()
    closing.setReadyState(closing.socket.CLOSING)
    acceptor.accept(closing.socket)
    expect(closing.close).toHaveBeenCalled()
    expect(closing.socket.addEventListener).not.toHaveBeenCalled()

    await transport.stop()
    const late = createSocket()
    acceptor.accept(late.socket)
    expect(late.close).toHaveBeenCalled()
    expect(late.socket.addEventListener).not.toHaveBeenCalled()
  })

  test('ignores messages after stop and logs malformed messages', async () => {
    const host = createWebSocketHost()
    const { agentContext, eventEmitter } = createAgentContext()
    const transport = new DidCommWsInboundTransport({ host })
    await transport.start(agentContext)

    const { socket, listeners } = createSocket()
    host.acceptor?.accept(socket)
    listeners.message[0]({ data: 'not json' })
    expect(agentContext.config.logger.error).toHaveBeenCalledTimes(1)

    await transport.stop()
    listeners.message[0]({ data: JSON.stringify(encryptedMessage) })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(eventEmitter.emit).not.toHaveBeenCalled()
  })

  test('serializes start and stop, attaching only once', async () => {
    const host = createWebSocketHost()
    const { agentContext } = createAgentContext()
    const transport = new DidCommWsInboundTransport({ host })

    await Promise.all([transport.start(agentContext), transport.start(agentContext), transport.stop()])
    expect(host.attach).toHaveBeenCalledTimes(1)
    expect(host.detach).toHaveBeenCalledTimes(1)

    await transport.stop()
    expect(host.detach).toHaveBeenCalledTimes(1)
  })

  test('can restart after the host fails to attach', async () => {
    const host = createWebSocketHost()
    const { agentContext } = createAgentContext()
    const transport = new DidCommWsInboundTransport({ host })
    host.attach.mockRejectedValueOnce(new Error('attach failed'))

    await expect(transport.start(agentContext)).rejects.toThrow('attach failed')
    await transport.stop()
    expect(host.detach).not.toHaveBeenCalled()
    await transport.start(agentContext)
    expect(host.attach).toHaveBeenCalledTimes(2)
  })
})

describe('DidCommModule inbound transport options', () => {
  test('uses explicitly configured inbound and outbound transport instances', () => {
    const inbound: DidCommInboundTransport[] = [{ start: vi.fn(), stop: vi.fn() }]
    const outbound: DidCommOutboundTransport[] = [
      { start: vi.fn(), stop: vi.fn(), supportedSchemes: ['test'], sendMessage: vi.fn() },
    ]
    const module = new DidCommModule({ transports: { inbound, outbound } })

    expect(module.config.inboundTransports).toEqual(inbound)
    expect(module.config.outboundTransports).toEqual(outbound)
    expect(inbound).toHaveLength(1)
  })

  test('stops started transports in reverse order when initialization fails', async () => {
    const stopped: string[] = []
    const transport = (name: string, fail = false): DidCommInboundTransport => ({
      start: vi.fn(async () => {
        if (fail) throw new Error(`${name} failed`)
      }),
      stop: vi.fn(async () => {
        stopped.push(name)
        if (name === 'first') throw new Error('stop failed')
      }),
    })
    const module = new DidCommModule({
      transports: { inbound: [transport('first'), transport('second'), transport('third', true)] },
    })
    const { agentContext } = createAgentContext()

    await expect(module.initialize(agentContext)).rejects.toThrow('third failed')
    expect(stopped).toEqual(['second', 'first'])
    expect(agentContext.config.logger.error).toHaveBeenCalledWith(
      'Failed to stop transport after DIDComm initialization failed',
      { error: new Error('stop failed') }
    )
  })
})
