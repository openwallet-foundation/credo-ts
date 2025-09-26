import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import type { DidCommCredentialV1Protocol } from '../DidCommCredentialV1Protocol'

import { DidCommCredentialV1ProblemReportMessage } from '../messages'

export class DidCommCredentialV1ProblemReportHandler implements DidCommMessageHandler {
  private credentialProtocol: DidCommCredentialV1Protocol
  public supportedMessages = [DidCommCredentialV1ProblemReportMessage]

  public constructor(credentialProtocol: DidCommCredentialV1Protocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommCredentialV1ProblemReportHandler>) {
    await this.credentialProtocol.processProblemReport(messageContext)

    return undefined
  }
}
