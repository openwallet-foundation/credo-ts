import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommConnectionProblemReportMessage } from '../messages'
import type { DidCommConnectionService } from '../services'

export class DidCommConnectionProblemReportHandler implements DidCommMessageHandler {
  private connectionService: DidCommConnectionService
  public supportedMessages = [DidCommConnectionProblemReportMessage]

  public constructor(connectionService: DidCommConnectionService) {
    this.connectionService = connectionService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommConnectionProblemReportHandler>) {
    await this.connectionService.processProblemReport(messageContext)

    return undefined
  }
}
