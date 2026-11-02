import { createServer, type Server } from 'node:http'
import { type AgentContext, EventEmitter } from '@credo-ts/core'
import { HttpRouter } from '@credo-ts/core/http'
import { expressHost } from '@credo-ts/core/http/express'
import { nodeHost } from '@credo-ts/core/http/node'
import express from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WebSocket, { WebSocketServer } from 'ws'
import type { DidCommMessageReceivedEvent } from '../../DidCommEvents'
import { DidCommTransportService } from '../../DidCommTransportService'
import { DidCommHttpInboundTransport } from '../DidCommHttpInboundTransport'
import { DidCommWsInboundTransport } from '../DidCommWsInboundTransport'

const servers: Server[] = []

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
})

function createAgentContext(router: HttpRouter) {
  const transportService = { removeSession: vi.fn() }
  const eventEmitter = { emit: vi.fn() }
  const dependencies = new Map<unknown, unknown>([
    [HttpRouter, router],
    [DidCommTransportService, transportService],
    [EventEmitter, eventEmitter],
  ])

  const agentContext = {
    config: { logger: { debug: vi.fn(), error: vi.fn() } },
    dependencyManager: { resolve: (dependency: unknown) => dependencies.get(dependency) },
  } as unknown as AgentContext

  return { agentContext, transportService, eventEmitter }
}

async function listen(server: Server) {
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Server did not bind to a TCP port')

  return address.port
}

function post(port: number, path: string, contentType = 'application/json', body: string | ReadableStream = '{}') {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
    duplex: 'half',
  } as RequestInit)
}

describe('DidCommHttpInboundTransport', () => {
  it('hosts the route on a Node.js server', async () => {
    const router = new HttpRouter()
    const server = createServer()
    router.addHost(nodeHost(server))
    const port = await listen(server)

    const transport = new DidCommHttpInboundTransport({ path: '/didcomm' })
    await transport.start(createAgentContext(router).agentContext)

    expect((await post(port, '/didcomm')).status).toBe(415)
    expect((await post(port, '/other')).status).toBe(404)

    await transport.stop()
    expect((await post(port, '/didcomm')).status).toBe(404)
  })

  it('hosts the route next to the routes of an Express app, without reading their bodies', async () => {
    const router = new HttpRouter()
    const app = express()
    let otherBody = ''
    app.post('/other', (request, response) => {
      request.on('data', (chunk) => {
        otherBody += chunk
      })
      request.on('end', () => response.status(204).end())
    })
    router.addHost(expressHost(app))
    const port = await listen(createServer(app))

    const transport = new DidCommHttpInboundTransport({ path: '/didcomm' })
    await transport.start(createAgentContext(router).agentContext)

    expect((await post(port, '/didcomm')).status).toBe(415)
    expect((await post(port, '/other', 'application/didcomm-encrypted+json', '{"unparsed":true}')).status).toBe(204)
    expect(otherBody).toBe('{"unparsed":true}')
  })

  it('rejects a body over 5MB, also without a content-length', async () => {
    const router = new HttpRouter()
    const server = createServer()
    router.addHost(nodeHost(server))
    const port = await listen(server)

    const { agentContext, eventEmitter } = createAgentContext(router)
    await new DidCommHttpInboundTransport().start(agentContext)

    let sentBytes = 0
    const endless = new ReadableStream({
      pull: (controller) => {
        sentBytes += 64 * 1024
        controller.enqueue(new Uint8Array(64 * 1024))
      },
    })

    expect((await post(port, '/', 'application/didcomm-envelope-enc', endless)).status).toBe(413)
    expect(sentBytes).toBeLessThan(10 * 1024 * 1024)
    expect(eventEmitter.emit).not.toHaveBeenCalled()
  })
})

describe('DidCommWsInboundTransport', () => {
  async function connect(port: number, path = '/') {
    const client = new WebSocket(`ws://127.0.0.1:${port}${path}`)
    await new Promise<void>((resolve, reject) => client.once('open', resolve).once('error', reject))
    return client
  }

  async function startTransport() {
    const router = new HttpRouter()
    const server = createServer()
    router.addHost(nodeHost(server))
    const port = await listen(server)

    const context = createAgentContext(router)
    const transport = new DidCommWsInboundTransport({ path: '/ws' })
    await transport.start(context.agentContext)

    return { ...context, server, port, transport }
  }

  it('receives messages and answers over the session', async () => {
    const { port, eventEmitter, transportService } = await startTransport()
    const client = await connect(port, '/ws')

    client.send('{"protected":"abc"}')
    await vi.waitFor(() => expect(eventEmitter.emit).toHaveBeenCalled())
    const event: DidCommMessageReceivedEvent = eventEmitter.emit.mock.calls[0][1]
    expect(event.payload.message).toEqual({ protected: 'abc' })

    const reply = new Promise((resolve) => client.once('message', (data) => resolve(data.toString())))
    await event.payload.session?.send({} as AgentContext, { protected: 'reply' } as never)
    expect(await reply).toBe('{"protected":"reply"}')

    const closed = new Promise((resolve) => client.once('close', resolve))
    await event.payload.session?.close()
    await closed
    await vi.waitFor(() => expect(transportService.removeSession).toHaveBeenCalledWith(event.payload.session))
  })

  it('closes the socket for a message over 5MB', async () => {
    const { port, eventEmitter } = await startTransport()
    const client = await connect(port, '/ws')

    const closed = new Promise<number>((resolve) => client.once('close', resolve))
    client.send('x'.repeat(6 * 1024 * 1024))
    expect(await closed).toBe(1009)
    expect(eventEmitter.emit).not.toHaveBeenCalled()
  })

  it('terminates connected clients when stopped', async () => {
    const { port, transport } = await startTransport()
    const client = await connect(port, '/ws')

    const closed = new Promise<number>((resolve) => client.once('close', resolve))
    await transport.stop()
    expect(await closed).toBe(1006)
  })

  it('leaves upgrades for other paths to the server', async () => {
    const { port, server } = await startTransport()
    const appSocketServer = new WebSocketServer({ noServer: true })
    server.on('upgrade', (request, socket, head) => {
      if (request.url === '/app') appSocketServer.handleUpgrade(request, socket, head, () => {})
    })

    const client = await connect(port, '/app')
    expect(client.readyState).toBe(WebSocket.OPEN)
    client.terminate()
    appSocketServer.close()
  })
})
