import type { Agent } from '../agent/Agent'
import type { TransportSession } from '../agent/TransportService'
import type { Logger } from '../logger'
import type { ConnectionRecord } from '../modules/connections'
import type { OutboundPackage } from '../types'
import type { OutboundTransporter } from './OutboundTransporter'
import type WebSocket from 'ws'

import { InjectionSymbols } from '../constants'

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
  private WebSocket: typeof WebSocket

  public supportedSchemes = ['ws', 'wss']

  public constructor(agent: Agent) {
    this.agent = agent
    this.logger = agent.injectionContainer.resolve(InjectionSymbols.Logger)
    this.WebSocket = agent.injectionContainer.resolve(InjectionSymbols.WebSocket)
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
    this.logger.debug(
      `Sending outbound message to connection ${connection.id} over ${session?.type} transport.`,
      payload
    )

    if (session instanceof WebSocketTransportSession && session.socket?.readyState === this.WebSocket.OPEN) {
      session.socket.send(JSON.stringify(payload))
    } else {
      const socket = await this.resolveSocket(connection, endpoint)
      socket.send(JSON.stringify(payload))
    }
  }

  private async resolveSocket(connection: ConnectionRecord, endpoint?: string) {
    // If we already have a socket connection use it
    let socket = this.transportTable.get(connection.id)

    if (!socket) {
      if (!endpoint) {
        throw new Error(`Missing endpoint. I don't know how and where to send the message.`)
      }
      socket = await this.createSocketConnection(endpoint)
      this.transportTable.set(connection.id, socket)
      this.listenOnWebSocketMessages(socket)
    }

    if (socket.readyState !== this.WebSocket.OPEN) {
      throw new Error('Socket is not open.')
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
      const socket = new this.WebSocket(endpoint)

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
