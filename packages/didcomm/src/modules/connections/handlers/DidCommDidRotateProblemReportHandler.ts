import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommDidRotateProblemReportMessage } from '../messages'
import type { DidCommDidRotateService } from '../services'

export class DidCommDidRotateProblemReportHandler implements DidCommMessageHandler {
  private didRotateService: DidCommDidRotateService
  public supportedMessages = [DidCommDidRotateProblemReportMessage]

  public constructor(didRotateService: DidCommDidRotateService) {
    this.didRotateService = didRotateService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommDidRotateProblemReportHandler>) {
    await this.didRotateService.processProblemReport(messageContext)

    return undefined
  }
}
