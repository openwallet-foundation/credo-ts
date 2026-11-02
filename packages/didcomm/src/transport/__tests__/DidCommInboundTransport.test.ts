import type { AgentContext } from '@credo-ts/core'
import { EventEmitter, InjectionSymbols } from '@credo-ts/core'
import type { WebSocketAcceptor, WebSocketAcceptorHost, WebSocketLike } from '@credo-ts/core/websocket'
import { Subject } from 'rxjs'
import { DidCommEventTypes } from '../../DidCommEvents'
import { DidCommMessageReceiver } from '../../DidCommMessageReceiver'
import { DidCommModule } from '../../DidCommModule'
import { DidCommModuleConfig } from '../../DidCommModuleConfig'
import { DidCommTransportService } from '../../DidCommTransportService'
import { DidCommMimeType } from '../../types'
import { DidCommHttpInboundTransport } from '../DidCommHttpInboundTransport'
import type { DidCommHttpInboundBinding, DidCommHttpInboundHost } from '../DidCommInboundHosting'
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
    binding: undefined as DidCommHttpInboundBinding | undefined,
    attach: vi.fn(async (binding: DidCommHttpInboundBinding) => {
      host.binding = binding
    }),
    detach: vi.fn(async (_binding: DidCommHttpInboundBinding) => {}),
  } satisfies DidCommHttpInboundHost & { binding?: DidCommHttpInboundBinding }
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
  if (!host.binding) throw new Error('No binding attached')
  return { ...context, host, transport, binding: host.binding }
}

async function handle(binding: DidCommHttpInboundBinding, body: string | undefined, contentType?: string) {
  const sent: Array<{ statusCode: number; body?: string; contentType?: string }> = []
  const response = {
    get headersSent() {
      return sent.length > 0
    },
    send: (statusCode: number, body?: string, contentType?: string) => {
      sent.push({ statusCode, body, contentType })
    },
  }
  await binding.handle({ body, contentType, onClose: vi.fn() }, response)
  return sent
}

describe('DidCommHttpInboundTransport', () => {
  test('attaches a binding on the configured path and detaches it on stop', async () => {
    const { host, transport, binding } = await startHttpTransport({ path: '/didcomm' })

    expect(binding).toMatchObject({
      path: '/didcomm',
      contentTypes: [DidCommMimeType.V0, DidCommMimeType.V1],
      maxBodyBytes: 5 * 1024 * 1024,
    })

    await transport.stop()
    expect(host.detach).toHaveBeenCalledWith(binding)
  })

  test('defaults the path to /', async () => {
    const { binding } = await startHttpTransport()

    expect(binding.path).toBe('/')
  })

  test('rejects unsupported content types with 415', async () => {
    const { binding } = await startHttpTransport()

    await expect(handle(binding, '{}', 'application/json')).resolves.toEqual([
      {
        statusCode: 415,
        body: `Unsupported content-type. Supported content-types are: ${DidCommMimeType.V0}, ${DidCommMimeType.V1}`,
        contentType: undefined,
      },
    ])
  })

  test('responds with 200 when the message is processed without a response', async () => {
    const { binding, transportService } = await startHttpTransport()

    await expect(handle(binding, JSON.stringify(encryptedMessage), DidCommMimeType.V1)).resolves.toEqual([
      { statusCode: 200, body: undefined, contentType: undefined },
    ])
    expect(transportService.removeSession).toHaveBeenCalled()
  })

  test('returns the response message using the request content type', async () => {
    const { binding } = await startHttpTransport({ respond: true })

    await expect(handle(binding, JSON.stringify(encryptedMessage), DidCommMimeType.V0)).resolves.toEqual([
      { statusCode: 200, body: JSON.stringify(encryptedMessage), contentType: DidCommMimeType.V0 },
    ])
  })

  test('responds with 500 when the message cannot be parsed', async () => {
    const { binding } = await startHttpTransport()

    await expect(handle(binding, 'not json', DidCommMimeType.V1)).resolves.toEqual([
      { statusCode: 500, body: 'Error processing message', contentType: undefined },
    ])
  })

  test('responds with 503 when stopped', async () => {
    const { binding, transport, eventEmitter } = await startHttpTransport()

    await transport.stop()

    await expect(handle(binding, JSON.stringify(encryptedMessage), DidCommMimeType.V1)).resolves.toEqual([
      { statusCode: 503, body: 'Service unavailable', contentType: undefined },
    ])
    expect(eventEmitter.emit).not.toHaveBeenCalled()
  })

  test('responds to in-flight requests and removes their sessions when stopped', async () => {
    const { binding, transport, transportService, agentContext } = await startHttpTransport({ process: false })

    const response = handle(binding, JSON.stringify(encryptedMessage), DidCommMimeType.V1)
    await vi.waitFor(() => expect(agentContext.dependencyManager.resolve).toHaveBeenCalledWith(EventEmitter))
    await transport.stop()

    await expect(response).resolves.toEqual([{ statusCode: 200, body: undefined, contentType: undefined }])
    expect(transportService.removeSession).toHaveBeenCalled()
    expect(agentContext.config.logger.error).not.toHaveBeenCalled()
  })

  test('serializes start and stop, and attaches once when started twice', async () => {
    const host = createHttpHost()
    const { agentContext } = createAgentContext()
    const transport = new DidCommHttpInboundTransport({ host })

    await Promise.all([transport.start(agentContext), transport.start(agentContext), transport.stop()])
    expect(host.attach).toHaveBeenCalledTimes(1)
    expect(host.detach).toHaveBeenCalledTimes(1)

    await transport.stop()
    expect(host.detach).toHaveBeenCalledTimes(1)
  })

  test('keeps the same binding and can be started again after the host fails to attach', async () => {
    const host = createHttpHost()
    const { agentContext } = createAgentContext()
    const transport = new DidCommHttpInboundTransport({ host })
    host.attach.mockRejectedValueOnce(new Error('attach failed'))

    await expect(transport.start(agentContext)).rejects.toThrow('attach failed')
    const binding = host.attach.mock.calls[0][0]
    await expect(handle(binding, JSON.stringify(encryptedMessage), DidCommMimeType.V1)).resolves.toEqual([
      { statusCode: 503, body: 'Service unavailable', contentType: undefined },
    ])

    await transport.start(agentContext)
    expect(host.attach).toHaveBeenLastCalledWith(binding)
    await expect(handle(binding, JSON.stringify(encryptedMessage), DidCommMimeType.V1)).resolves.toEqual([
      { statusCode: 200, body: undefined, contentType: undefined },
    ])
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
