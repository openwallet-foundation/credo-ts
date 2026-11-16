import { createServer, request as httpRequest, type Server } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import type { AgentContext } from '@credo-ts/core'
import { EventEmitter, JsonEncoder } from '@credo-ts/core'
import type { DidCommEncryptedMessage } from '@credo-ts/didcomm'
import { DidCommMimeType, DidCommModuleConfig, DidCommTransportService } from '@credo-ts/didcomm'
import express from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WebSocket, { WebSocketServer } from 'ws'

import { DidCommHttpInboundTransport, HttpTransportSession } from '../DidCommHttpInboundTransport'
import { DidCommWsInboundTransport, WebSocketTransportSession } from '../DidCommWsInboundTransport'

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

type ReceivedEvent = { payload: { message: unknown; session: HttpTransportSession } }

function createAgentContext({
  v2 = false,
  processMessage = async () => {},
}: {
  v2?: boolean
  processMessage?: (event: ReceivedEvent, failProcessing: (error: Error) => void) => Promise<void>
} = {}) {
  const transportService = {
    removeSession: vi.fn(),
  }
  // The transport only listens for processing failures
  const processingFailedListeners = new Set<(event: unknown) => void>()
  const eventEmitter = {
    on: vi.fn((_type, listener) => processingFailedListeners.add(listener)),
    off: vi.fn((_type, listener) => processingFailedListeners.delete(listener)),
    emit: vi.fn((_agentContext, event: ReceivedEvent) =>
      processMessage(event, (error) => {
        for (const listener of processingFailedListeners)
          listener({ payload: { message: event.payload.message, error } })
      })
    ),
  }

  return {
    config: {
      logger: {
        debug: vi.fn(),
        error: vi.fn(),
      },
    },
    dependencyManager: {
      resolve: vi.fn((dependency) => {
        if (dependency === DidCommTransportService) {
          return transportService
        }

        if (dependency === DidCommModuleConfig) {
          return {
            endpoints: [],
            didCommMimeType: DidCommMimeType.V0,
            isSupported: (version: string) => version === 'v1' || v2,
          }
        }

        if (dependency === EventEmitter) {
          return eventEmitter
        }

        throw new Error(`Unexpected dependency: ${dependency.name}`)
      }),
    },
  } as unknown as AgentContext
}

async function listen(server: Server) {
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()

  if (!address || typeof address === 'string') {
    throw new Error('Server did not bind to a TCP port')
  }

  return address.port
}

function createApp() {
  const app = express()
  return app
}

describe('DIDComm inbound transports', () => {
  it('terminates active WebSocket clients during shutdown', async () => {
    const socketServer = new WebSocketServer({ noServer: true })
    const publicServer = createServer()
    publicServer.on('upgrade', (request, socket, head) => {
      socketServer.handleUpgrade(request, socket, head, (webSocket) => {
        socketServer.emit('connection', webSocket, request)
      })
    })
    const port = await listen(publicServer)

    const transport = new DidCommWsInboundTransport({ server: socketServer })
    await transport.start(createAgentContext())

    const client = new WebSocket(`ws://127.0.0.1:${port}`)
    await new Promise<void>((resolve) => client.once('open', resolve))

    const closed = new Promise<number>((resolve) => client.once('close', (code) => resolve(code)))
    const abnormalClosureCode = 1006
    await transport.stop()
    await expect(closed).resolves.toBe(abnormalClosureCode)
  })

  it('closes the WebSocket without crashing when a message exceeds the size limit', async () => {
    const socketServer = new WebSocketServer({ noServer: true, maxPayload: 100 })
    const publicServer = createServer()
    publicServer.on('upgrade', (request, socket, head) => {
      socketServer.handleUpgrade(request, socket, head, (webSocket) => {
        socketServer.emit('connection', webSocket, request)
      })
    })
    const port = await listen(publicServer)

    const agentContext = createAgentContext()
    const transport = new DidCommWsInboundTransport({ server: socketServer })
    await transport.start(agentContext)

    const client = new WebSocket(`ws://127.0.0.1:${port}`)
    await new Promise<void>((resolve) => client.once('open', resolve))

    const closed = new Promise<number>((resolve) => client.once('close', (code) => resolve(code)))
    client.send('a'.repeat(200))

    const messageTooBigCode = 1009
    await expect(closed).resolves.toBe(messageTooBigCode)
    expect(agentContext.config.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Max payload size exceeded'),
      expect.anything()
    )
    await transport.stop()
  })

  it('closes the WebSocket when the session is closed', async () => {
    const socketServer = new WebSocketServer({ noServer: true })
    const publicServer = createServer()
    publicServer.on('upgrade', (request, socket, head) => {
      socketServer.handleUpgrade(request, socket, head, (webSocket) => {
        socketServer.emit('connection', webSocket, request)
      })
    })
    const port = await listen(publicServer)

    const serverSocketPromise = new Promise<WebSocket>((resolve) => socketServer.once('connection', resolve))
    const client = new WebSocket(`ws://127.0.0.1:${port}`)
    await new Promise<void>((resolve) => client.once('open', resolve))
    const serverSocket = await serverSocketPromise

    const logger = createAgentContext().config.logger
    const session = new WebSocketTransportSession('session-id', serverSocket, logger)

    const closed = new Promise<void>((resolve) => client.once('close', () => resolve()))
    await session.close()
    await closed

    expect(serverSocket.readyState).not.toBe(WebSocket.OPEN)

    socketServer.close()
  })

  it('rejects startup when its configured port cannot bind', async () => {
    const occupiedServer = createServer()
    const port = await listen(occupiedServer)
    const transport = new DidCommHttpInboundTransport({ port })

    await expect(transport.start(createAgentContext())).rejects.toMatchObject({ code: 'EADDRINUSE' })
  })

  it('registers a route without binding or closing a host-owned server', async () => {
    const app = createApp()
    const publicServer = createServer(app)
    const transport = new DidCommHttpInboundTransport({ app, path: '/didcomm' })

    await transport.start(createAgentContext())
    expect(transport.server).toBeUndefined()

    const port = await listen(publicServer)
    const response = await fetch(`http://127.0.0.1:${port}/didcomm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })

    expect(response.status).toBe(415)
    await transport.stop()
    expect(publicServer.listening).toBe(true)
  })

  it.each([
    'application/didcomm-encrypted+json',
    'didcomm-encrypted+json',
    'Application/DIDComm-Encrypted+JSON; charset=utf-8',
  ])('accepts a DIDComm v2 encrypted message sent as %s', async (contentType) => {
    const app = createApp()
    const agentContext = createAgentContext({ v2: true })
    const transport = new DidCommHttpInboundTransport({ app, path: '/didcomm' })

    await transport.start(agentContext)
    const port = await listen(createServer(app))
    const response = await fetch(`http://127.0.0.1:${port}/didcomm`, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: '{"protected":"e30"}',
    })

    expect(response.status).toBe(202)
    const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      agentContext,
      expect.objectContaining({ payload: expect.objectContaining({ message: { protected: 'e30' } }) })
    )
  })

  it.each([
    { respondAfterProcessing: false, processedBeforeResponse: false },
    { respondAfterProcessing: true, processedBeforeResponse: true },
  ])(
    'with respondAfterProcessing $respondAfterProcessing, processing has finished before the response: $processedBeforeResponse',
    async ({ respondAfterProcessing, processedBeforeResponse }) => {
      let processed = false
      const agentContext = createAgentContext({
        processMessage: async (event) => {
          // The message receiver closes the session when no response is sent over it
          await event.payload.session.close()
          await sleep(50)
          processed = true
        },
      })
      const app = createApp()
      const transport = new DidCommHttpInboundTransport({ app, respondAfterProcessing })

      await transport.start(agentContext)
      const port = await listen(createServer(app))
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        method: 'POST',
        headers: { 'content-type': DidCommMimeType.V1 },
        body: '{}',
      })

      expect(response.status).toBe(202)
      expect(processed).toBe(processedBeforeResponse)
    }
  )

  it('responds with 500 when processing the message fails', async () => {
    const agentContext = createAgentContext({
      processMessage: async (_event, failProcessing) => failProcessing(new Error('Processing failed')),
    })
    const app = createApp()
    const transport = new DidCommHttpInboundTransport({ app })

    await transport.start(agentContext)
    const port = await listen(createServer(app))
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      method: 'POST',
      headers: { 'content-type': DidCommMimeType.V1 },
      body: '{}',
    })

    expect(response.status).toBe(500)
  })

  it('removes the HTTP session when the client closes the connection, not when the request body is read', async () => {
    const app = createApp()
    const agentContext = createAgentContext()
    const transportService = agentContext.dependencyManager.resolve(DidCommTransportService)
    const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)
    // The message stays in processing, so no response is sent
    const received = new Promise<void>((resolve) =>
      vi.mocked(eventEmitter.emit).mockImplementation(() => {
        resolve()
        return new Promise(() => {})
      })
    )
    const transport = new DidCommHttpInboundTransport({
      app,
      path: '/didcomm',
      processedMessageListenerTimeoutMs: 2000,
    })

    await transport.start(agentContext)
    const port = await listen(createServer(app))
    const request = httpRequest({
      port,
      path: '/didcomm',
      method: 'POST',
      headers: { 'content-type': DidCommMimeType.V1 },
    })
    request.on('error', () => {})
    request.end('{}')

    await received
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(transportService.removeSession).not.toHaveBeenCalled()

    request.destroy()
    await vi.waitFor(() => expect(transportService.removeSession).toHaveBeenCalledTimes(1))
  })

  it('reports an HTTP session as closed once it is answered', async () => {
    const agentContext = createAgentContext()
    const app = createApp()
    const closed: boolean[] = []
    app.post('/didcomm', async (req, res) => {
      const session = new HttpTransportSession('session', req, res)
      closed.push(session.isClosed)
      await session.send(agentContext, { protected: 'e30' } as DidCommEncryptedMessage)
      closed.push(session.isClosed)
    })

    const port = await listen(createServer(app))
    await fetch(`http://127.0.0.1:${port}/didcomm`, { method: 'POST', body: '{}' })

    expect(closed).toEqual([false, true])
  })

  it('accepts a DIDComm v2 signed message sent as application/didcomm-signed+json', async () => {
    const app = createApp()
    const agentContext = createAgentContext({ v2: true })
    const transport = new DidCommHttpInboundTransport({ app, path: '/didcomm' })

    await transport.start(agentContext)
    const port = await listen(createServer(app))
    const response = await fetch(`http://127.0.0.1:${port}/didcomm`, {
      method: 'POST',
      headers: { 'content-type': 'application/didcomm-signed+json' },
      body: '{"payload":"e30"}',
    })

    expect(response.status).toBe(202)
  })

  it('rejects the DIDComm v2 encrypted media type when v2 is not enabled', async () => {
    const app = createApp()
    const agentContext = createAgentContext()
    const transport = new DidCommHttpInboundTransport({ app, path: '/didcomm' })

    await transport.start(agentContext)
    const port = await listen(createServer(app))
    const response = await fetch(`http://127.0.0.1:${port}/didcomm`, {
      method: 'POST',
      headers: { 'content-type': 'application/didcomm-encrypted+json' },
      body: '{"protected":"e30"}',
    })

    expect(response.status).toBe(415)
  })

  it('does not parse DIDComm content sent to another route', async () => {
    const app = createApp()
    let requestBody: string | undefined
    app.post('/other', (request, response) => {
      request.on('data', (chunk) => {
        requestBody = (requestBody ?? '') + chunk
      })
      request.on('end', () => response.status(204).end())
    })
    const publicServer = createServer(app)
    const transport = new DidCommHttpInboundTransport({ app, path: '/didcomm' })

    await transport.start(createAgentContext())
    const port = await listen(publicServer)
    const response = await fetch(`http://127.0.0.1:${port}/other`, {
      method: 'POST',
      headers: { 'content-type': 'application/didcomm-encrypted+json' },
      body: '{"unparsed":true}',
    })

    expect(response.status).toBe(204)
    expect(requestBody).toBe('{"unparsed":true}')
  })

  const jweFields = { iv: 'iv', ciphertext: 'ciphertext', tag: 'tag' }
  it.each([
    {
      version: 'v2',
      message: {
        ...jweFields,
        protected: JsonEncoder.toBase64Url({ alg: 'ECDH-ES+A256KW', enc: 'A256GCM' }),
        recipients: [{ header: { kid: 'did:example:bob#key-1' }, encrypted_key: 'key' }],
      },
      expected: 'application/didcomm-encrypted+json',
    },
    {
      version: 'v1',
      message: {
        ...jweFields,
        protected: JsonEncoder.toBase64Url({ enc: 'xchacha20poly1305_ietf', typ: 'JWM/1.0', alg: 'Anoncrypt' }),
      },
      expected: DidCommMimeType.V1,
    },
  ])('replies to a v1 typed request with a $version envelope as $expected', async ({ message, expected }) => {
    const encryptedMessage = message as DidCommEncryptedMessage
    const agentContext = createAgentContext({ v2: true })
    const app = createApp()
    app.post('/didcomm', async (req, res) => {
      await new HttpTransportSession('session', req, res).send(agentContext, encryptedMessage)
    })

    const port = await listen(createServer(app))
    const response = await fetch(`http://127.0.0.1:${port}/didcomm`, {
      method: 'POST',
      headers: { 'content-type': DidCommMimeType.V1 },
      body: '{}',
    })

    expect(response.headers.get('content-type')).toContain(expected)
    expect(await response.json()).toEqual(encryptedMessage)
  })
})
