import { createServer } from 'node:http'
import type { AgentContext } from '@credo-ts/core'
import { EventEmitter } from '@credo-ts/core'
import { DidCommWsOutboundTransport } from '@credo-ts/didcomm'
import { Subject } from 'rxjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WebSocket, { WebSocketServer } from 'ws'

import { agentDependencies } from '../index'

const cleanup: Array<() => Promise<void>> = []

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((fn) => fn()))
})

function createAgentContext() {
  const eventEmitter = new EventEmitter(agentDependencies, new Subject())

  return {
    config: {
      logger: { debug: vi.fn(), error: vi.fn(), trace: vi.fn() },
      agentDependencies,
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

async function startTransport() {
  const transport = new DidCommWsOutboundTransport()
  await transport.start(createAgentContext())
  cleanup.push(() => transport.stop())

  return transport
}

async function waitForSockets(serverSockets: WebSocket[], count: number) {
  for (let i = 0; i < 100 && serverSockets.length < count; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
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
})
