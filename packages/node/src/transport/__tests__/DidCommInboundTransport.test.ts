import { createServer, type Server } from 'node:http'
import type { AgentContext } from '@credo-ts/core'
import { EventEmitter, JsonEncoder } from '@credo-ts/core'
import type { DidCommEncryptedMessage } from '@credo-ts/didcomm'
import { DidCommEventTypes, DidCommMimeType, DidCommModuleConfig, DidCommTransportService } from '@credo-ts/didcomm'
import express from 'express'
import { Subject } from 'rxjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WebSocket, { WebSocketServer } from 'ws'

import { DidCommHttpInboundTransport, HttpTransportSession } from '../DidCommHttpInboundTransport'
import { DidCommWsInboundTransport } from '../DidCommWsInboundTransport'

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

function createAgentContext({ v2 = false } = {}) {
  const transportService = {
    removeSession: vi.fn(),
  }
  const processedEvents = new Subject()
  const eventEmitter = {
    observable: () => processedEvents,
    emit: vi.fn((_agentContext, event: { payload: { message: unknown } }) =>
      processedEvents.next({
        type: DidCommEventTypes.DidCommMessageProcessed,
        payload: { encryptedMessage: event.payload.message },
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

    expect(response.status).toBe(200)
    const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      agentContext,
      expect.objectContaining({ payload: expect.objectContaining({ message: { protected: 'e30' } }) })
    )
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

    expect(response.status).toBe(200)
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
