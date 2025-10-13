import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import { ActionMenuProblemReportMessage } from '../messages'
import type { ActionMenuService } from '../services'

/**
 * @internal
 */
export class ActionMenuProblemReportHandler implements DidCommMessageHandler {
  private actionMenuService: ActionMenuService
  public supportedMessages = [ActionMenuProblemReportMessage]

  public constructor(actionMenuService: ActionMenuService) {
    this.actionMenuService = actionMenuService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<ActionMenuProblemReportHandler>) {
    await this.actionMenuService.processProblemReport(messageContext)

    return undefined
  }
}
