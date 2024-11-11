import type { ConnectionService } from '../../services'
import type { MessageHandler, MessageHandlerInboundMessage } from '../MessageHandler'

import { ConnectionProblemReportMessage } from '../../messages'

export class ConnectionProblemReportHandler implements MessageHandler {
  private connectionService: ConnectionService
  public supportedMessages = [ConnectionProblemReportMessage]

  public constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<ConnectionProblemReportHandler>) {
    await this.connectionService.processProblemReport(messageContext)
  }
}
