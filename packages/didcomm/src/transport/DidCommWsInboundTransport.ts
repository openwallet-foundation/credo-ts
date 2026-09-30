import type { AgentContext, Logger } from '@credo-ts/core'
import { CredoError, EventEmitter, utils } from '@credo-ts/core'
import type { DidCommMessageReceivedEvent } from '../DidCommEvents'
import { DidCommEventTypes } from '../DidCommEvents'
import { DidCommModuleConfig } from '../DidCommModuleConfig'
import type { DidCommTransportSession } from '../DidCommTransportService'
import { DidCommTransportService } from '../DidCommTransportService'
import type { DidCommEncryptedMessage } from '../types'
import type { DidCommWebSocket, DidCommWebSocketAcceptor, DidCommWebSocketHost } from './DidCommInboundHosting'
import type { DidCommInboundTransport } from './DidCommInboundTransport'

// WebSocket.OPEN
const WEB_SOCKET_OPEN = 1

export interface DidCommWsInboundTransportOptions {
  /**
   * The host that accepts WebSocket connections, for example `webSocketHost()` from `@credo-ts/node`.
   */
  host: DidCommWebSocketHost
}

export class DidCommWsInboundTransport implements DidCommInboundTransport {
  private readonly host: DidCommWebSocketHost
  private readonly acceptor: DidCommWebSocketAcceptor
  private agentContext?: AgentContext
  private lifecycle: Promise<void> = Promise.resolve()

  private sessions = new Map<DidCommWebSocket, WebSocketTransportSession>()

  public constructor({ host }: DidCommWsInboundTransportOptions) {
    this.host = host
    this.acceptor = {
      accept: (socket) => this.accept(socket),
    }
  }

  public start(agentContext: AgentContext): Promise<void> {
    return this.enqueue(async () => {
      if (this.agentContext) return

      const didcommConfig = agentContext.dependencyManager.resolve(DidCommModuleConfig)
      const wsEndpoint = didcommConfig.endpoints.find((e) => e.startsWith('ws'))
      agentContext.config.logger.debug('Starting WS inbound transport', {
        endpoint: wsEndpoint,
      })

      this.agentContext = agentContext

      try {
        await this.host.attach(this.acceptor)
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
      await this.host.detach(this.acceptor)
    })
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.lifecycle.then(operation, operation)
    this.lifecycle = result.catch(() => undefined)
    return result
  }

  private accept(socket: DidCommWebSocket) {
    const agentContext = this.agentContext
    if (!agentContext || socket.readyState !== WEB_SOCKET_OPEN) {
      socket.close()
      return
    }
    if (this.sessions.has(socket)) return

    const logger = agentContext.config.logger

    const session = new WebSocketTransportSession(utils.uuid(), socket, logger)
    this.sessions.set(socket, session)

    socket.addEventListener('message', (event) => {
      this.onMessage(agentContext, socket, session, event.data)
    })
    socket.addEventListener('close', () => {
      logger.debug('Socket closed.')
      if (this.sessions.get(socket) !== session) return
      this.sessions.delete(socket)
      this.removeSavedSession(agentContext, session)
    })
  }

  private onMessage(
    agentContext: AgentContext,
    socket: DidCommWebSocket,
    session: WebSocketTransportSession,
    data: unknown
  ) {
    const logger = agentContext.config.logger
    logger.debug('WebSocket message event received.')

    try {
      const encryptedMessage = JSON.parse(data as string) as DidCommEncryptedMessage

      // Ignore messages that arrive after the transport was stopped or the socket's session was replaced
      if (this.agentContext !== agentContext || this.sessions.get(socket) !== session) return

      const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)
      eventEmitter.emit<DidCommMessageReceivedEvent>(agentContext, {
        type: DidCommEventTypes.DidCommMessageReceived,
        payload: {
          message: encryptedMessage,
          session: session,
        },
      })
    } catch (error) {
      logger.error(`Error processing message: ${error}`)
    }
  }

  private terminateAll(agentContext: AgentContext) {
    for (const [socket, session] of this.sessions) {
      this.sessions.delete(socket)
      socket.terminate()
      try {
        this.removeSavedSession(agentContext, session)
      } catch (error) {
        agentContext.config.logger.error(`Error removing WebSocket session: ${error}`)
      }
    }
  }

  private removeSavedSession(agentContext: AgentContext, session: WebSocketTransportSession) {
    const transportService = agentContext.dependencyManager.resolve(DidCommTransportService)
    // Only remove the session while it is saved, so a session that was already removed or replaced is not removed twice
    if (transportService.findSessionById(session.id) === session) {
      transportService.removeSession(session)
    }
  }
}

export class WebSocketTransportSession implements DidCommTransportSession {
  public id: string
  public readonly type = 'WebSocket'
  public socket: DidCommWebSocket
  private logger: Logger

  public constructor(id: string, socket: DidCommWebSocket, logger: Logger) {
    this.id = id
    this.socket = socket
    this.logger = logger
  }

  public async send(_agentContext: AgentContext, encryptedMessage: DidCommEncryptedMessage): Promise<void> {
    if (this.socket.readyState !== WEB_SOCKET_OPEN) {
      throw new CredoError(`${this.type} transport session has been closed.`)
    }
    this.socket.send(JSON.stringify(encryptedMessage), (error?) => {
      // biome-ignore lint/suspicious/noDoubleEquals: If error check is added as '!==' it fails the check
      if (error != undefined) {
        this.logger.debug(`Error sending message: ${error}`)
        throw new CredoError(`${this.type} send message failed.`, { cause: error })
      }
      this.logger.debug(`${this.type} sent message successfully.`)
    })
  }

  public async close(): Promise<void> {
    if (this.socket.readyState === WEB_SOCKET_OPEN) {
      this.socket.close()
    }
  }
}
