import { OutboundTransporter } from './OutboundTransporter'
import { Agent } from '../agent/Agent'
import { WebSocketTransport } from '../agent/TransportService'
import { Logger } from '../logger'
import { ConnectionRecord } from '../modules/connections'
import { OutboundPackage } from '../types'
import { Symbols } from '../symbols'
import { WebSocket } from '../utils/ws'

export class WsOutboundTransporter implements OutboundTransporter {
  private transportTable: Map<string, WebSocket> = new Map<string, WebSocket>()
  private agent: Agent
  private logger: Logger

  public supportedSchemes = ['ws', 'wss']

  public constructor(agent: Agent) {
    this.agent = agent
    this.logger = agent.injectionContainer.resolve(Symbols.Logger)
  }
  public async start(): Promise<void> {
    // Nothing required to start WS
  }

  public async stop() {
    this.transportTable.forEach((socket) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      socket.removeAllListeners()
      socket.close()
    })
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    const { connection, payload, transport } = outboundPackage
    this.logger.debug(
      `Sending outbound message to connection ${connection.id} over ${transport?.type} transport.`,
      payload
    )

    if (transport instanceof WebSocketTransport) {
      const socket = await this.resolveSocket(connection, transport)
      socket.send(JSON.stringify(payload))
    } else {
      throw new Error(`Unsupported transport ${transport?.type}.`)
    }
  }

  private async resolveSocket(connection: ConnectionRecord, transport: WebSocketTransport) {
    // If we already have a socket connection use it
    if (transport.socket?.readyState === WebSocket.OPEN) {
      return transport.socket
    }

    let socket = this.transportTable.get(connection.id)

    if (!socket) {
      if (!transport.endpoint) {
        throw new Error(`Missing endpoint. I don't know how and where to send the message.`)
      }
      socket = await this.createSocketConnection(transport.endpoint)
      this.transportTable.set(connection.id, socket)
      this.listenOnWebSocketMessages(this.agent, socket)
    }

    if (socket.readyState !== WebSocket.OPEN) {
      throw new Error('Socket is not open.')
    }

    return socket
  }

  private listenOnWebSocketMessages(agent: Agent, socket: WebSocket) {
    socket.addEventListener('message', (event: any) => {
      this.logger.debug('WebSocket message event received.', { url: event.target.url, data: event.data })
      agent.receiveMessage(JSON.parse(event.data))
    })
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
