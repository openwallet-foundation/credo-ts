import type { Agent } from '../agent/Agent'
import type { TransportSession } from '../agent/TransportService'
import type { Logger } from '../logger'
import type { OutboundPackage } from '../types'
import type { OutboundTransporter } from './OutboundTransporter'

import { InjectionSymbols } from '../constants'
import { AriesFrameworkError } from '../error'
import { WebSocket } from '../utils/ws'

export class WebSocketTransportSession implements TransportSession {
  public readonly type = 'websocket'
  public socket?: WebSocket

  public constructor(socket?: WebSocket) {
    this.socket = socket
  }
}

export class WsOutboundTransporter implements OutboundTransporter {
  private transportTable: Map<string, WebSocket> = new Map<string, WebSocket>()
  private agent: Agent
  private logger: Logger

  public supportedSchemes = ['ws', 'wss']

  public constructor(agent: Agent) {
    this.agent = agent
    this.logger = agent.injectionContainer.resolve(InjectionSymbols.Logger)
  }

  public async start(): Promise<void> {
    // Nothing required to start WS
  }

  public async stop() {
    this.transportTable.forEach((socket) => {
      socket.removeEventListener('message', this.handleMessageEvent)
      socket.close()
    })
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    const { connection, payload, endpoint, session } = outboundPackage
    this.logger.debug(`Sending outbound message to endpoint '${endpoint}' over ${session?.type} transport.`, {
      payload,
      connectionId: connection?.id,
    })

    // If session is already available, use it
    if (session instanceof WebSocketTransportSession && session.socket?.readyState === WebSocket.OPEN) {
      session.socket.send(JSON.stringify(payload))
    }
    // Else if a socket is available for this connection, use it
    else if (connection) {
      const socket = await this.resolveSocket(connection.id, endpoint)
      socket.send(JSON.stringify(payload))
    }
    // Else use a long-lived socket (connection-less)
    else {
      if (!endpoint) {
        throw new AriesFrameworkError(`Missing endpoint. I don't know how and where to send the message.`)
      }

      const socket = await this.resolveSocket(endpoint, endpoint)
      socket.send(JSON.stringify(payload))
    }
  }

  private async resolveSocket(socketIdentifier: string, endpoint?: string) {
    // If we already have a socket connection use it
    let socket = this.transportTable.get(socketIdentifier)

    if (!socket) {
      if (!endpoint) {
        throw new AriesFrameworkError(`Missing endpoint. I don't know how and where to send the message.`)
      }
      socket = await this.createSocketConnection(endpoint)
      this.transportTable.set(socketIdentifier, socket)
      this.listenOnWebSocketMessages(socket)
    }

    if (socket.readyState !== WebSocket.OPEN) {
      throw new AriesFrameworkError('Websocket is not open.')
    }

    return socket
  }

  // NOTE: Because this method is passed to the event handler this must be a lambda method
  // so 'this' is scoped to the 'WsOutboundTransporter' class instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleMessageEvent = (event: any) => {
    this.logger.debug('WebSocket message event received.', { url: event.target.url, data: event.data })
    this.agent.receiveMessage(JSON.parse(event.data))
  }

  private listenOnWebSocketMessages(socket: WebSocket) {
    socket.addEventListener('message', this.handleMessageEvent)
  }

  private createSocketConnection(endpoint: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      this.logger.debug(`Connecting to WebSocket ${endpoint}`)
      const socket = new WebSocket(endpoint)

      socket.onopen = () => {
        this.logger.debug(`Successfully connected to WebSocket ${endpoint}`)
        resolve(socket)
      }

      socket.onerror = (error) => {
        this.logger.debug(`Error while connecting to WebSocket ${endpoint}`, {
          error,
        })
        reject(error)
      }
    })
  }
}
