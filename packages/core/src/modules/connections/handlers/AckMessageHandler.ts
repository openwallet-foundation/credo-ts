import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV1Message } from '../../../agent/didcomm'
import type { ConnectionService } from '../services/ConnectionService'

import { AckMessage } from '../../common'

export class AckMessageHandler implements Handler<typeof DIDCommV1Message> {
  private connectionService: ConnectionService
  public supportedMessages = [AckMessage]

  public constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService
  }

  public async handle(inboundMessage: HandlerInboundMessage<AckMessageHandler>) {
    await this.connectionService.processAck(inboundMessage)
  }
}
