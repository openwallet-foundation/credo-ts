import type { AgentContext } from '@credo-ts/core'
import { EventEmitter } from '@credo-ts/core'
import { Subject } from 'rxjs'
import { DidCommEventTypes } from '../../DidCommEvents'
import { DidCommModule } from '../../DidCommModule'
import { DidCommModuleConfig } from '../../DidCommModuleConfig'
import { DidCommTransportService } from '../../DidCommTransportService'
import { DidCommMimeType } from '../../types'
import { DidCommHttpInboundTransport } from '../DidCommHttpInboundTransport'
import type {
  DidCommHttpInboundBinding,
  DidCommHttpInboundHost,
  DidCommWebSocket,
  DidCommWebSocketAcceptor,
  DidCommWebSocketHost,
} from '../DidCommInboundHosting'
import type { DidCommInboundTransport } from '../DidCommInboundTransport'
import type { DidCommOutboundTransport } from '../DidCommOutboundTransport'
import { DidCommWsInboundTransport } from '../DidCommWsInboundTransport'

const encryptedMessage = { protected: 'p', iv: 'i', ciphertext: 'c', tag: 't' }

function createAgentContext({ respond }: { respond?: boolean } = {}) {
  const processed = new Subject<unknown>()
  const transportService = { removeSession: vi.fn() }
  const eventEmitter = {
    observable: vi.fn(() => processed.asObservable()),
    // biome-ignore lint/suspicious/noExplicitAny: test double
    emit: vi.fn(async (agentContext: AgentContext, event: any) => {
      if (event.type !== DidCommEventTypes.DidCommMessageReceived) return
      if (respond) await event.payload.session.send(agentContext, event.payload.message)
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
    acceptor: undefined as DidCommWebSocketAcceptor | undefined,
    attach: vi.fn(async (acceptor: DidCommWebSocketAcceptor) => {
      host.acceptor = acceptor
    }),
    detach: vi.fn(async (_acceptor: DidCommWebSocketAcceptor) => {}),
  } satisfies DidCommWebSocketHost & { acceptor?: DidCommWebSocketAcceptor }
  return host
}

async function startHttpTransport(options: { path?: string; respond?: boolean } = {}) {
  const host = createHttpHost()
  const context = createAgentContext({ respond: options.respond })
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
})

describe('DidCommWsInboundTransport', () => {
  function createSocket() {
    const listeners: Record<string, Array<(event?: unknown) => void>> = {}
    const socket = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn((type: string, listener: (event?: unknown) => void) => {
        listeners[type] = [...(listeners[type] ?? []), listener]
      }),
    }
    return { socket: socket as unknown as DidCommWebSocket & typeof socket, listeners }
  }

  test('emits received messages, terminates sockets on stop and removes closed sessions', async () => {
    const host = createWebSocketHost()
    const { agentContext, eventEmitter, transportService } = createAgentContext()
    const transport = new DidCommWsInboundTransport({ host })
    await transport.start(agentContext)

    const { socket, listeners } = createSocket()
    host.acceptor?.accept(socket)
    listeners.message[0]({ data: JSON.stringify(encryptedMessage) })

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      agentContext,
      expect.objectContaining({
        type: DidCommEventTypes.DidCommMessageReceived,
        payload: expect.objectContaining({ message: encryptedMessage }),
      })
    )

    await transport.stop()
    expect(socket.terminate).toHaveBeenCalled()
    expect(host.detach).toHaveBeenCalledWith(host.acceptor)

    listeners.close[0]()
    expect(transportService.removeSession).toHaveBeenCalled()
  })
})

describe('DidCommModule inbound transport options', () => {
  test('uses explicitly configured inbound and outbound transport instances', () => {
    const inbound: DidCommInboundTransport[] = [{ start: vi.fn(), stop: vi.fn() }]
    const outbound: DidCommOutboundTransport[] = [
      { start: vi.fn(), stop: vi.fn(), supportedSchemes: ['test'], sendMessage: vi.fn() },
    ]
    const module = new DidCommModule({
      transports: { inbound, outbound },
    })

    expect(module.config.inboundTransports).toEqual(inbound)
    expect(module.config.outboundTransports).toEqual(outbound)
    expect(inbound).toHaveLength(1)
  })
})
