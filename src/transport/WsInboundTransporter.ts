import type { Agent } from '../agent/Agent'
import type { Logger } from '../logger'
import type { InboundTransporter } from './InboundTransporter'

import { InjectionSymbols } from '../constants'

export class WsInboundTransporter implements InboundTransporter {
  private agent: Agent
  private logger: Logger
  public supportedSchemes = ['ws', 'wss']
  private mediatorSocket: WebSocket | null = null
  private mediatorEndpoint = ''

  public constructor(agent: Agent) {
    this.agent = agent
    this.logger = agent.injectionContainer.resolve(InjectionSymbols.Logger)
  }
  public async start() {
    /** nothing to see here*/
  }
  public async stop() {
    this.mediatorSocket?.close()
  }
  public createMediatorSocket(invitationURL: string) {
    this.mediatorEndpoint = invitationURL.split('?')[0]
    const socket = new WebSocket(this.mediatorEndpoint)
    socket.onmessage = (event) => {
      this.logger.debug('Socket, Message received from mediator:', event.data)
      const payload = JSON.parse(Buffer.from(event.data).toString('utf-8'))
      this.logger.debug('Payload', payload)
      this.agent.receiveMessage(payload)
    }
    socket.onerror = (error) => {
      this.logger.debug('Socket ERROR', error)
    }
    socket.onopen = async () => {
      this.logger.debug('Socket has been opened')
      const mediator = await this.agent.mediationRecipient.getDefaultMediatorConnection()
      this.logger.debug('Mediator connection record:', mediator)
      if (mediator) {
        this.logger.debug('Sending ping to mediator')
        const ping = await this.agent.connections.preparePing(mediator, { responseRequested: false })
        this.logger.debug('Ping:', ping)
        const packed = await this.agent.preparePackMessage(ping)
        if (packed) {
          this.logger.debug('Packed:', packed.payload)
          const messageBuffer = Buffer.from(JSON.stringify(packed.payload))
          this.logger.debug('MessageBuffer:', messageBuffer)
          socket.send(messageBuffer)
        }
      }
    }
    socket.onclose = () => {
      this.logger.debug('Socket closed')
      // TODO: do attempt timeout, or something
      this.createMediatorSocket(invitationURL)
    }
    this.mediatorSocket = socket
  }
}
