import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ActionMenuService } from '../services'

import { ActionMenuProblemReportMessage } from '../messages'

export class ActionMenuProblemReportHandler implements Handler {
  private actionMenuService: ActionMenuService
  public supportedMessages = [ActionMenuProblemReportMessage]

  public constructor(actionMenuService: ActionMenuService) {
    this.actionMenuService = actionMenuService
  }

  public async handle(messageContext: HandlerInboundMessage<ActionMenuProblemReportHandler>) {
    await this.actionMenuService.processProblemReport(messageContext)
  }
}
