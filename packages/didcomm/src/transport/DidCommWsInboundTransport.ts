import type { AgentContext } from '@credo-ts/core'
import { CredoError, EventEmitter } from '@credo-ts/core'
import { HttpRouter, type WebSocketPeer, type WebSocketRoute } from '@credo-ts/core/http'
import { DidCommEventTypes, type DidCommMessageReceivedEvent } from '../DidCommEvents'
import { DidCommTransportService, type DidCommTransportSession } from '../DidCommTransportService'
import type { DidCommEncryptedMessage } from '../types'
import type { DidCommInboundTransport } from './DidCommInboundTransport'

export interface DidCommWsInboundTransportOptions {
  /**
   * @default '/'
   */
  path?: string
}

/**
 * Receives DIDComm messages over WebSockets on the agent's {@link HttpRouter}. The agent's `http` hosts must host
 * WebSockets, such as `nodeHost(server)`, `expressHost(app, { server })` or `bunHost()`.
 */
export class DidCommWsInboundTransport implements DidCommInboundTransport {
  private path: string
  private route?: WebSocketRoute
  private router?: HttpRouter
  private sessions = new Map<string, DidCommWsTransportSession>()

  public constructor(options: DidCommWsInboundTransportOptions = {}) {
    this.path = options.path ?? '/'
  }

  public async start(agentContext: AgentContext) {
    agentContext.config.logger.debug('Starting WS inbound transport', { path: this.path })

    this.router = agentContext.dependencyManager.resolve(HttpRouter)
    this.route = this.createRoute(agentContext)
    this.router.addWebSocketRoute(this.route)
  }

  public async stop() {
    if (this.route) this.router?.removeWebSocketRoute(this.route)

    for (const session of this.sessions.values()) session.peer.terminate()
    this.sessions.clear()
  }

  private createRoute(agentContext: AgentContext): WebSocketRoute {
    const transportService = agentContext.dependencyManager.resolve(DidCommTransportService)
    const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)
    const logger = agentContext.config.logger

    return {
      path: this.path,
      open: (peer) => {
        logger.debug(`Saving new socket with id ${peer.id}.`)
        this.sessions.set(peer.id, new DidCommWsTransportSession(peer))
      },
      message: (peer, message) => {
        // A host that lets sockets outlive the process, such as a hibernating Cloudflare Durable Object, has no session yet
        let session = this.sessions.get(peer.id)
        if (!session) {
          session = new DidCommWsTransportSession(peer)
          this.sessions.set(peer.id, session)
        }

        try {
          eventEmitter.emit<DidCommMessageReceivedEvent>(agentContext, {
            type: DidCommEventTypes.DidCommMessageReceived,
            payload: { message: JSON.parse(message.text()) as DidCommEncryptedMessage, session },
          })
        } catch (error) {
          logger.error(`Error processing message: ${error}`)
        }
      },
      close: (peer) => {
        logger.debug('Socket closed.')
        const session = this.sessions.get(peer.id)
        this.sessions.delete(peer.id)
        if (!session) return

        session.closed = true
        transportService.removeSession(session)
      },
    }
  }
}

export class DidCommWsTransportSession implements DidCommTransportSession {
  public readonly type = 'WebSocket'
  public readonly id: string
  public closed = false

  public constructor(public readonly peer: WebSocketPeer) {
    this.id = peer.id
  }

  public async send(_agentContext: AgentContext, encryptedMessage: DidCommEncryptedMessage): Promise<void> {
    if (this.closed) {
      throw new CredoError(`${this.type} transport session has been closed.`)
    }

    this.peer.send(JSON.stringify(encryptedMessage))
  }

  public async close(): Promise<void> {
    this.closed = true
    this.peer.close()
  }
}
