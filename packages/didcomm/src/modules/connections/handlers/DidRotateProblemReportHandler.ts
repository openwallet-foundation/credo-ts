import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommDidRotateService } from '../services'

import { DidRotateProblemReportMessage } from '../messages'

export class DidRotateProblemReportHandler implements DidCommMessageHandler {
  private didRotateService: DidCommDidRotateService
  public supportedMessages = [DidRotateProblemReportMessage]

  public constructor(didRotateService: DidCommDidRotateService) {
    this.didRotateService = didRotateService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidRotateProblemReportHandler>) {
    await this.didRotateService.processProblemReport(messageContext)

    return undefined
  }
}
