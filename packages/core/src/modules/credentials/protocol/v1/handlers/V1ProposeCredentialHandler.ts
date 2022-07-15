import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { Logger } from '../../../../../logger'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V1CredentialService } from '../V1CredentialService'

import { createOutboundMessage } from '../../../../../agent/helpers'
import { V1ProposeCredentialMessage } from '../messages'

export class V1ProposeCredentialHandler implements Handler {
  private credentialService: V1CredentialService
  private logger: Logger
  public supportedMessages = [V1ProposeCredentialMessage]

  public constructor(credentialService: V1CredentialService, logger: Logger) {
    this.credentialService = credentialService
    this.logger = logger
  }

  public async handle(messageContext: HandlerInboundMessage<V1ProposeCredentialHandler>) {
    const credentialRecord = await this.credentialService.processProposal(messageContext)

    const shouldAutoAcceptProposal = await this.credentialService.shouldAutoRespondToProposal(
      messageContext.agentContext,
      {
        credentialRecord,
        proposalMessage: messageContext.message,
      }
    )

    if (shouldAutoAcceptProposal) {
      return await this.acceptProposal(credentialRecord, messageContext)
    }
  }

  private async acceptProposal(
    credentialRecord: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<V1ProposeCredentialHandler>
  ) {
    this.logger.info(
      `Automatically sending offer with autoAccept on ${messageContext.agentContext.config.autoAcceptCredentials}`
    )

    if (!messageContext.connection) {
      this.logger.error('No connection on the messageContext, aborting auto accept')
      return
    }

    const { message } = await this.credentialService.acceptProposal(messageContext.agentContext, {
      credentialRecord,
    })

    return createOutboundMessage(messageContext.connection, message)
  }
}
