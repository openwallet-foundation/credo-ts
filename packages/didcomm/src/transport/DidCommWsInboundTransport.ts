import type { AgentContext, Logger } from '@credo-ts/core'
import { CredoError, EventEmitter, JsonEncoder, utils } from '@credo-ts/core'
import type { WebSocketAcceptor, WebSocketAcceptorHost, WebSocketLike } from '@credo-ts/core/websocket'
import type { DidCommMessageReceivedEvent } from '../DidCommEvents'
import { DidCommEventTypes } from '../DidCommEvents'
import { DidCommModuleConfig } from '../DidCommModuleConfig'
import type { DidCommTransportSession } from '../DidCommTransportService'
import { DidCommTransportService } from '../DidCommTransportService'
import type { DidCommEncryptedMessage } from '../types'
import type { DidCommInboundTransport } from './DidCommInboundTransport'

export interface DidCommWsInboundTransportOptions {
  /**
   * The host that accepts WebSocket connections, for example `webSocketHost()` from `@credo-ts/node/websocket`.
   */
  host?: WebSocketAcceptorHost
}

export class DidCommWsInboundTransport implements DidCommInboundTransport {
  public readonly acceptor: WebSocketAcceptor

  private readonly host?: WebSocketAcceptorHost
  private agentContext?: AgentContext
  private lifecycle: Promise<void> = Promise.resolve()
  private readonly sessions = new Map<WebSocketLike, WebSocketTransportSession>()

  public constructor({ host }: DidCommWsInboundTransportOptions = {}) {
    this.host = host
    this.acceptor = { accept: (socket) => this.accept(socket) }
  }

  public start(agentContext: AgentContext): Promise<void> {
    return this.enqueue(async () => {
      if (this.agentContext) return

      const didcommConfig = agentContext.dependencyManager.resolve(DidCommModuleConfig)
      const wsEndpoint = didcommConfig.endpoints.find((endpoint) => endpoint.startsWith('ws'))
      agentContext.config.logger.debug('Starting WS inbound transport', {
        endpoint: wsEndpoint,
      })
      this.agentContext = agentContext

      try {
        await this.host?.attach(this.acceptor)
      } catch (error) {
        this.agentContext = undefined
        this.terminateAll(agentContext)
        throw error
      }
    })
  }

  public stop(): Promise<void> {
    return this.enqueue(async () => {
      const agentContext = this.agentContext
      if (!agentContext) return

      agentContext.config.logger.debug('Closing WebSocket Server')
      this.agentContext = undefined
      this.terminateAll(agentContext)
      await this.host?.detach(this.acceptor)
    })
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.lifecycle.then(operation, operation)
    this.lifecycle = result.catch(() => undefined)
    return result
  }

  private accept(socket: WebSocketLike): void {
    const agentContext = this.agentContext
    if (!agentContext || socket.readyState !== socket.OPEN) {
      socket.close()
      return
    }
    if (this.sessions.has(socket)) return

    const session = new WebSocketTransportSession(utils.uuid(), socket, agentContext.config.logger)
    this.sessions.set(socket, session)
    socket.addEventListener('message', (event) => {
      void this.onMessage(agentContext, socket, session, event.data)
    })
    socket.addEventListener('close', () => {
      if (this.sessions.get(socket) !== session) return
      this.sessions.delete(socket)
      this.removeSavedSession(agentContext, session)
    })
  }

  private async onMessage(
    agentContext: AgentContext,
    socket: WebSocketLike,
    session: WebSocketTransportSession,
    data: unknown
  ): Promise<void> {
    try {
      const encryptedMessage =
        typeof data === 'string'
          ? (JsonEncoder.fromUtf8String(data) as DidCommEncryptedMessage)
          : data instanceof Uint8Array
            ? (JsonEncoder.fromUint8Array(data) as DidCommEncryptedMessage)
            : undefined

      if (!encryptedMessage) throw new CredoError('Unsupported WebSocket message data')
      if (this.agentContext !== agentContext || this.sessions.get(socket) !== session) return

      const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)
      eventEmitter.emit<DidCommMessageReceivedEvent>(agentContext, {
        type: DidCommEventTypes.DidCommMessageReceived,
        payload: { message: encryptedMessage, session },
      })
    } catch (error) {
      agentContext.config.logger.error(`Error processing WebSocket message: ${String(error)}`)
    }
  }

  private terminateAll(agentContext: AgentContext): void {
    for (const [socket, session] of this.sessions) {
      this.sessions.delete(socket)
      try {
        this.removeSavedSession(agentContext, session)
      } catch (error) {
        agentContext.config.logger.error(`Error removing WebSocket session: ${String(error)}`)
      }
      socket.close()
    }
  }

  private removeSavedSession(agentContext: AgentContext, session: WebSocketTransportSession): void {
    const transportService = agentContext.dependencyManager.resolve(DidCommTransportService)
    if (transportService.findSessionById(session.id) === session) {
      transportService.removeSession(session)
    }
  }
}

export class WebSocketTransportSession implements DidCommTransportSession {
  public readonly type = 'WebSocket'

  public constructor(
    public id: string,
    public readonly socket: WebSocketLike,
    private readonly logger: Logger
  ) {}

  public async send(_agentContext: AgentContext, encryptedMessage: DidCommEncryptedMessage): Promise<void> {
    if (this.socket.readyState !== this.socket.OPEN) {
      throw new CredoError(`${this.type} transport session has been closed.`)
    }

    try {
      this.socket.send(JSON.stringify(encryptedMessage))
      this.logger.debug(`${this.type} sent message successfully.`)
    } catch (error) {
      throw new CredoError(`${this.type} send message failed.`, { cause: error })
    }
  }

  public async close(): Promise<void> {
    if (this.socket.readyState === this.socket.OPEN) this.socket.close()
  }
}
