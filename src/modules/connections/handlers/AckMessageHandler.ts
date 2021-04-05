import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { ConnectionService } from '../services/ConnectionService'
import { AckMessage } from '../../common'

export class AckMessageHandler implements Handler {
  private connectionService: ConnectionService
  public supportedMessages = [AckMessage]

  public constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService
  }

  public async handle(inboundMessage: HandlerInboundMessage<AckMessageHandler>) {
    await this.connectionService.processAck(inboundMessage)
  }
}
