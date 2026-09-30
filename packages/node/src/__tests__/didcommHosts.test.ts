import { createServer, type Server } from 'node:http'
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
import WebSocket from 'ws'

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

function createAgentContext() {
  const processed = new Subject<unknown>()
  const eventEmitter = {
    observable: vi.fn(() => processed.asObservable()),
    // biome-ignore lint/suspicious/noExplicitAny: test double
    emit: vi.fn(async (agentContext: AgentContext, event: any) => {
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
  it('listens on the configured port and returns responses from the DIDComm transport', async () => {
    const host = httpServerHost({ port: 0 })
    const transport = new DidCommHttpInboundTransport({ host, path: '/didcomm' })

    await transport.start(createAgentContext())
    expect(host.server?.listening).toBe(true)
    const port = boundPort(host.server)

    const response = await fetch(`http://127.0.0.1:${port}/didcomm`, {
      method: 'POST',
      headers: { 'content-type': DidCommMimeType.V0 },
      body: JSON.stringify(encryptedMessage),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(`${DidCommMimeType.V0}; charset=utf-8`)
    await expect(response.json()).resolves.toEqual(encryptedMessage)

    await transport.stop()
    expect(host.server?.listening).toBe(false)
  })
})

describe('expressHost', () => {
  it('mounts on an application-owned app without listening', async () => {
    const app = express()
    const host = expressHost({ app })
    const transport = new DidCommHttpInboundTransport({ host })

    await transport.start(createAgentContext())
    expect(host.server).toBeUndefined()

    const port = await listen(createServer(app))
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      method: 'POST',
      headers: { 'content-type': DidCommMimeType.V1 },
      body: JSON.stringify(encryptedMessage),
    })

    expect(response.status).toBe(200)
    await transport.stop()
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
    await expect(closed).resolves.toBe(1006)
    expect(host.server).toBeUndefined()
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
