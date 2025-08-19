import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommConnectionService } from '../services'

import { ConnectionProblemReportMessage } from '../messages'

export class ConnectionProblemReportHandler implements DidCommMessageHandler {
  private connectionService: DidCommConnectionService
  public supportedMessages = [ConnectionProblemReportMessage]

  public constructor(connectionService: DidCommConnectionService) {
    this.connectionService = connectionService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<ConnectionProblemReportHandler>) {
    await this.connectionService.processProblemReport(messageContext)

    return undefined
  }
}
