import { createServer, request as httpRequest, type Server } from 'node:http'
import type { AgentContext } from '@credo-ts/core'
import { EventEmitter } from '@credo-ts/core'
import {
  DidCommEventTypes,
  DidCommHttpInboundTransport,
  DidCommMimeType,
  DidCommModule,
  DidCommModuleConfig,
  DidCommTransportService,
  DidCommWsInboundTransport,
} from '@credo-ts/didcomm'
import express from 'express'
import { Subject } from 'rxjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WebSocket, { WebSocketServer } from 'ws'

import { expressHost, httpServerHost } from '../express'
import { webSocketHost } from '../webSocketHost'

const encryptedMessage = { protected: 'p', iv: 'i', ciphertext: 'c', tag: 't' }
const servers: Server[] = []

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
      )
  )
})

async function listen(server: Server) {
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()

  if (!address || typeof address === 'string') {
    throw new Error('Server did not bind to a TCP port')
  }

  return address.port
}

function boundPort(server: { address(): ReturnType<Server['address']> } | undefined) {
  const address = server?.address()

  if (!address || typeof address === 'string') {
    throw new Error('Host did not bind to a TCP port')
  }

  return address.port
}

function createAgentContext({
  processMessages = true,
  onMessageReceived,
}: {
  processMessages?: boolean
  onMessageReceived?: () => void
} = {}) {
  const processed = new Subject<unknown>()
  const eventEmitter = {
    observable: vi.fn(() => processed.asObservable()),
    // biome-ignore lint/suspicious/noExplicitAny: test double
    emit: vi.fn(async (agentContext: AgentContext, event: any) => {
      onMessageReceived?.()
      if (!processMessages) return

      await event.payload.session.send(agentContext, event.payload.message)
      processed.next({
        type: DidCommEventTypes.DidCommMessageProcessed,
        payload: { encryptedMessage: event.payload.message },
      })
    }),
  }

  return {
    config: { logger: { debug: vi.fn(), error: vi.fn() } },
    dependencyManager: {
      resolve: vi.fn((dependency) => {
        if (dependency === DidCommTransportService) return { removeSession: vi.fn(), findSessionById: vi.fn() }
        if (dependency === DidCommModuleConfig) return { endpoints: [], didCommMimeType: DidCommMimeType.V1 }
        if (dependency === EventEmitter) return eventEmitter
        throw new Error(`Unexpected dependency: ${dependency.name}`)
      }),
    },
  } as unknown as AgentContext
}

describe('httpServerHost', () => {
  it('keeps one owned listener open until its last binding detaches', async () => {
    const host = httpServerHost({ port: 0 })
    const post = vi.spyOn(host.app, 'post')
    const didcomm = new DidCommHttpInboundTransport({ host, path: '/didcomm' })
    const pickup = new DidCommHttpInboundTransport({ host, path: '/pickup' })
    const agentContext = createAgentContext()

    await didcomm.start(agentContext)
    const server = host.server
    expect(server?.listening).toBe(true)
    const port = boundPort(server)

    await pickup.start(agentContext)
    expect(host.server).toBe(server)
    expect(post).toHaveBeenCalledTimes(2)

    const postMessage = (path: string) =>
      fetch(`http://127.0.0.1:${port}${path}`, {
        method: 'POST',
        headers: { 'content-type': DidCommMimeType.V1 },
        body: JSON.stringify(encryptedMessage),
      })

    expect((await postMessage('/didcomm')).status).toBe(200)
    expect((await postMessage('/pickup')).status).toBe(200)

    await didcomm.stop()
    expect(server?.listening).toBe(true)
    expect((await postMessage('/didcomm')).status).toBe(503)
    expect((await postMessage('/pickup')).status).toBe(200)

    await didcomm.start(agentContext)
    expect(post).toHaveBeenCalledTimes(2)
    expect((await postMessage('/didcomm')).status).toBe(200)

    await didcomm.stop()
    expect(server?.listening).toBe(true)
    await pickup.stop()
    expect(server?.listening).toBe(false)
  })

  it('listens on the configured port and returns responses from the DIDComm transport', async () => {
    const host = httpServerHost({ port: 0 })
    const transport = new DidCommHttpInboundTransport({ host, path: '/didcomm' })

    await transport.start(createAgentContext())
    const server = host.server
    expect(server?.listening).toBe(true)
    const port = boundPort(server)

    const response = await fetch(`http://127.0.0.1:${port}/didcomm`, {
      method: 'POST',
      headers: { 'content-type': DidCommMimeType.V0 },
      body: JSON.stringify(encryptedMessage),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(`${DidCommMimeType.V0}; charset=utf-8`)
    await expect(response.json()).resolves.toEqual(encryptedMessage)

    await transport.stop()
    expect(server?.listening).toBe(false)
    expect(host.server).toBeUndefined()
  })

  it('force-closes a request stalled during body parsing after the drain deadline', async () => {
    const host = httpServerHost({ port: 0 })
    const transport = new DidCommHttpInboundTransport({ host, path: '/didcomm' })
    await transport.start(createAgentContext())
    const server = host.server
    const port = boundPort(server)

    const request = httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/didcomm',
      method: 'POST',
      headers: {
        'content-type': DidCommMimeType.V1,
        'content-length': '1000000',
      },
    })
    request.on('error', () => {})
    request.flushHeaders()
    await new Promise<void>((resolve) => setTimeout(resolve, 20))

    vi.useFakeTimers()
    try {
      const stopping = transport.stop()
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(15_000)
      await stopping

      expect(server?.listening).toBe(false)
      expect(host.server).toBeUndefined()
    } finally {
      vi.useRealTimers()
      request.destroy()
    }
  })

  it('settles in-flight DIDComm requests before waiting for the listener to close', async () => {
    let messageReceived: (() => void) | undefined
    const received = new Promise<void>((resolve) => {
      messageReceived = resolve
    })
    const host = httpServerHost({ port: 0 })
    const transport = new DidCommHttpInboundTransport({ host, path: '/didcomm' })
    await transport.start(createAgentContext({ processMessages: false, onMessageReceived: () => messageReceived?.() }))
    const server = host.server
    const port = boundPort(server)

    const response = fetch(`http://127.0.0.1:${port}/didcomm`, {
      method: 'POST',
      headers: { 'content-type': DidCommMimeType.V1 },
      body: JSON.stringify(encryptedMessage),
    })
    await received

    await transport.stop()
    expect((await response).status).toBe(200)
    expect(server?.listening).toBe(false)
  })
})

describe('expressHost', () => {
  it('mounts on an application-owned app without listening', async () => {
    const app = express()
    const host = expressHost({ app })
    const transport = new DidCommHttpInboundTransport({ host })

    await transport.start(createAgentContext())
    expect(host.server).toBeUndefined()

    const server = createServer(app)
    const port = await listen(server)
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      method: 'POST',
      headers: { 'content-type': DidCommMimeType.V1 },
      body: JSON.stringify(encryptedMessage),
    })

    expect(response.status).toBe(200)
    await transport.stop()
    expect(server.listening).toBe(true)
  })
})

describe('webSocketHost', () => {
  it('listens when attached and closes when detached', async () => {
    const host = webSocketHost({ port: 0 })
    const transport = new DidCommWsInboundTransport({ host })

    expect(host.server).toBeUndefined()
    await transport.start(createAgentContext())
    expect(host.server).toBeDefined()
    const port = boundPort(host.server)

    const client = new WebSocket(`ws://127.0.0.1:${port}`)
    await new Promise<void>((resolve) => client.once('open', resolve))
    const reply = new Promise<string>((resolve) => client.once('message', (data) => resolve(data.toString())))
    client.send(JSON.stringify(encryptedMessage))
    await expect(reply).resolves.toBe(JSON.stringify(encryptedMessage))

    const closed = new Promise<number>((resolve) => client.once('close', (code) => resolve(code)))
    await transport.stop()
    await expect(closed).resolves.toBe(1005)
    expect(host.server).toBeUndefined()
  })

  it('keeps an application-supplied server open and refuses connections while stopped', async () => {
    const socketServer = new WebSocketServer({ noServer: true })
    const publicServer = createServer()
    publicServer.on('upgrade', (request, socket, head) => {
      socketServer.handleUpgrade(request, socket, head, (webSocket) => {
        socketServer.emit('connection', webSocket, request)
      })
    })
    const port = await listen(publicServer)
    const host = webSocketHost({ server: socketServer })
    const transport = new DidCommWsInboundTransport({ host })

    const connect = async () => {
      const client = new WebSocket(`ws://127.0.0.1:${port}`)
      const closed = new Promise<number>((resolve) => client.once('close', (code) => resolve(code)))
      await new Promise<void>((resolve) => client.once('open', resolve))
      return { client, closed }
    }
    const tryAgainLater = 1013

    const beforeStart = await connect()
    await expect(beforeStart.closed).resolves.toBe(tryAgainLater)

    await transport.start(createAgentContext())
    await transport.stop()
    expect(host.server).toBe(socketServer)

    const whileStopped = await connect()
    await expect(whileStopped.closed).resolves.toBe(tryAgainLater)

    await transport.start(createAgentContext())
    const { client } = await connect()
    const reply = new Promise<string>((resolve) => client.once('message', (data) => resolve(data.toString())))
    client.send(JSON.stringify(encryptedMessage))
    await expect(reply).resolves.toBe(JSON.stringify(encryptedMessage))

    await transport.stop()
    await new Promise<void>((resolve, reject) => socketServer.close((error) => (error ? reject(error) : resolve())))
  })

  it('rejects attach when the configured port cannot bind', async () => {
    const port = await listen(createServer())
    const transport = new DidCommWsInboundTransport({ host: webSocketHost({ port }) })

    await expect(transport.start(createAgentContext())).rejects.toMatchObject({ code: 'EADDRINUSE' })
  })
})

describe('DidCommModule inbound transport options', () => {
  it('accepts built-in transports with explicit Node hosts', () => {
    const module = new DidCommModule({
      transports: {
        inbound: [
          new DidCommHttpInboundTransport({ host: httpServerHost({ port: 0 }) }),
          new DidCommWsInboundTransport({ host: webSocketHost({ port: 0 }) }),
        ],
      },
    })

    expect(module.config.inboundTransports).toEqual([
      expect.any(DidCommHttpInboundTransport),
      expect.any(DidCommWsInboundTransport),
    ])
  })
})
