import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidRotateService } from '../services'

import { DidRotateProblemReportMessage } from '../messages'

export class DidRotateProblemReportHandler implements DidCommMessageHandler {
  private didRotateService: DidRotateService
  public supportedMessages = [DidRotateProblemReportMessage]

  public constructor(didRotateService: DidRotateService) {
    this.didRotateService = didRotateService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidRotateProblemReportHandler>) {
    await this.didRotateService.processProblemReport(messageContext)

    return undefined
  }
}
