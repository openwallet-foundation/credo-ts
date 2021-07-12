import type { Agent, InboundTransporter, OutboundPackage } from '../../src'
import type { TransportSession } from '../../src/agent/TransportService'

import WebSocket from 'ws'

import { AriesFrameworkError } from '../../src'
import logger from '../../src/__tests__/logger'
import { AgentConfig } from '../../src/agent/AgentConfig'
import { TransportService } from '../../src/agent/TransportService'
import { uuid } from '../../src/utils/uuid'

export class WsInboundTransporter implements InboundTransporter {
  private socketServer: WebSocket.Server

  // We're using a `socketId` just for the prevention of calling the connection handler twice.
  private socketIds: Record<string, unknown> = {}

  public constructor(socketServer: WebSocket.Server) {
    this.socketServer = socketServer
  }

  public async start(agent: Agent) {
    const transportService = agent.injectionContainer.resolve(TransportService)
    const config = agent.injectionContainer.resolve(AgentConfig)

    config.logger.debug(`Starting HTTP inbound transporter`, {
      port: config.port,
      endpoint: config.getEndpoint(),
    })

    this.socketServer.on('connection', (_: WebSocket.Server, socket: WebSocket) => {
      const socketId = uuid()
      logger.debug('Socket connected.')

      if (!this.socketIds[socketId]) {
        logger.debug(`Saving new socket with id ${socketId}.`)
        this.socketIds[socketId] = socket
        const session = new WebSocketTransportSession(socketId, socket)
        this.listenOnWebSocketMessages(agent, socket, session)
        socket.on('close', () => {
          logger.debug('Socket closed.')
          transportService.removeSession(session)
        })
      } else {
        logger.debug(`Socket with id ${socketId} already exists.`)
      }
    })
  }

  public async stop() {
    logger.debug('Closing WebSocket Server')

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
      logger.debug('WebSocket message event received.', { url: event.target.url, data: event.data })
      try {
        await agent.receiveMessage(JSON.parse(event.data), session)
      } catch (error) {
        logger.error('Error processing message')
      }
    })
  }
}

export class WebSocketTransportSession implements TransportSession {
  public id: string
  public readonly type = 'WebSocket'
  public socket: WebSocket

  public constructor(id: string, socket: WebSocket) {
    this.id = id
    this.socket = socket
  }

  public async send(outboundMessage: OutboundPackage): Promise<void> {
    // logger.debug(`Sending outbound message via ${this.type} transport session`)
    if (this.socket.readyState !== WebSocket.OPEN) {
      throw new AriesFrameworkError(`${this.type} transport session has been closed.`)
    }

    this.socket.send(JSON.stringify(outboundMessage.payload))
  }
}
