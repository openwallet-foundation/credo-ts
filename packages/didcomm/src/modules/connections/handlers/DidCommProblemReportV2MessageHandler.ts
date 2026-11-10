import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommProblemReportV2Message } from '../../../messages'

export class DidCommProblemReportV2MessageHandler implements DidCommMessageHandler {
  public supportedMessages = [DidCommProblemReportV2Message]

  // Registering the type validates a received report and surfaces it through DidCommMessageProcessed
  public async handle(_inbound: DidCommMessageHandlerInboundMessage<DidCommProblemReportV2MessageHandler>) {
    return undefined
  }
}
