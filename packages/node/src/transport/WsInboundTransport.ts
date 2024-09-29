import type {
  Agent,
  InboundTransport,
  Logger,
  TransportSession,
  EncryptedMessage,
  AgentContext,
  AgentMessageReceivedEvent,
} from '@credo-ts/core'

import { CredoError, TransportService, utils, AgentEventTypes } from '@credo-ts/core'
// eslint-disable-next-line import/no-named-as-default
import WebSocket, { Server } from 'ws'

export class WsInboundTransport implements InboundTransport {
  private socketServer: Server
  private logger!: Logger

  // We're using a `socketId` just for the prevention of calling the connection handler twice.
  private socketIds: Record<string, unknown> = {}

  public constructor({ server, port }: { server: Server; port?: undefined } | { server?: undefined; port: number }) {
    this.socketServer = server ?? new Server({ port })
  }

  public async start(agent: Agent) {
    const transportService = agent.dependencyManager.resolve(TransportService)

    this.logger = agent.config.logger

    const wsEndpoint = agent.config.endpoints.find((e) => e.startsWith('ws'))
    this.logger.debug(`Starting WS inbound transport`, {
      endpoint: wsEndpoint,
    })

    this.socketServer.on('connection', (socket: WebSocket) => {
      const socketId = utils.uuid()
      this.logger.debug('Socket connected.')

      if (!this.socketIds[socketId]) {
        this.logger.debug(`Saving new socket with id ${socketId}.`)
        this.socketIds[socketId] = socket
        const session = new WebSocketTransportSession(socketId, socket, this.logger)
        this.listenOnWebSocketMessages(agent, socket, session)
        socket.on('close', () => {
          this.logger.debug('Socket closed.')
          transportService.removeSession(session)
        })
      } else {
        this.logger.debug(`Socket with id ${socketId} already exists.`)
      }
    })
  }

  public async stop() {
    this.logger.debug('Closing WebSocket Server')

    return new Promise<void>((resolve, reject) => {
      this.socketServer.close((error) => {
        if (error) {
          reject(error)
        }
        resolve()
      })
    })
  }

  private listenOnWebSocketMessages(agent: Agent, socket: WebSocket, session: TransportSession) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.addEventListener('message', async (event: any) => {
      this.logger.debug('WebSocket message event received.', { url: event.target.url })
      try {
        const encryptedMessage = JSON.parse(event.data) as EncryptedMessage

        agent.events.emit<AgentMessageReceivedEvent>(agent.context, {
          type: AgentEventTypes.AgentMessageReceived,
          payload: {
            message: encryptedMessage,
            session: session,
          },
        })
      } catch (error) {
        this.logger.error(`Error processing message: ${error}`)
      }
    })
  }
}

export class WebSocketTransportSession implements TransportSession {
  public id: string
  public readonly type = 'WebSocket'
  public socket: WebSocket
  private logger: Logger

  public constructor(id: string, socket: WebSocket, logger: Logger) {
    this.id = id
    this.socket = socket
    this.logger = logger
  }

  public async send(agentContext: AgentContext, encryptedMessage: EncryptedMessage): Promise<void> {
    if (this.socket.readyState !== WebSocket.OPEN) {
      throw new CredoError(`${this.type} transport session has been closed.`)
    }
    this.socket.send(JSON.stringify(encryptedMessage), (error?) => {
      if (error != undefined) {
        this.logger.debug(`Error sending message: ${error}`)
        throw new CredoError(`${this.type} send message failed.`, { cause: error })
      } else {
        this.logger.debug(`${this.type} sent message successfully.`)
      }
    })
  }

  public async close(): Promise<void> {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.close()
    }
  }
}
