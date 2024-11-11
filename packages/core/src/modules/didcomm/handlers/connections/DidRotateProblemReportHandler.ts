import type { DidRotateService } from '../../services'
import type { MessageHandler, MessageHandlerInboundMessage } from '../MessageHandler'

import { DidRotateProblemReportMessage } from '../../messages'

export class DidRotateProblemReportHandler implements MessageHandler {
  private didRotateService: DidRotateService
  public supportedMessages = [DidRotateProblemReportMessage]

  public constructor(didRotateService: DidRotateService) {
    this.didRotateService = didRotateService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<DidRotateProblemReportHandler>) {
    await this.didRotateService.processProblemReport(messageContext)
  }
}
