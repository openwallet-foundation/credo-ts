import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import { DidCommMessagePickupV4ProblemReportMessage } from '../messages'

export class DidCommMessagePickupV4ProblemReportHandler implements DidCommMessageHandler {
  public supportedMessages = [DidCommMessagePickupV4ProblemReportMessage]

  // Registering the type stops the dispatcher from replying to the mediator's problem report with another problem report.
  public async handle(
    _messageContext: DidCommMessageHandlerInboundMessage<DidCommMessagePickupV4ProblemReportHandler>
  ) {
    return undefined
  }
}
