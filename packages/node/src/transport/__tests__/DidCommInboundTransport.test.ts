import { createServer, type Server } from 'node:http'
import type { AgentContext } from '@credo-ts/core'
import { DidCommModuleConfig, DidCommTransportService } from '@credo-ts/didcomm'
import express, { type Express } from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WebSocket, { WebSocketServer } from 'ws'

import { DidCommHttpInboundTransport } from '../DidCommHttpInboundTransport'
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

function createAgentContext() {
  const transportService = {
    removeSession: vi.fn(),
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
          return { endpoints: [] }
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

    const closed = new Promise<void>((resolve) => client.once('close', resolve))
    await transport.stop()
    await closed
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

  it('requires an app when no port is supplied', () => {
    // @ts-expect-error An HTTP inbound transport needs either an app or a port.
    new DidCommHttpInboundTransport({})

    const app: Express = createApp()
    new DidCommHttpInboundTransport({ app, port: 0 })
  })
})
