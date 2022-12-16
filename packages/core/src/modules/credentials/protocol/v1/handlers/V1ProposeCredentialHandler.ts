import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { Logger } from '../../../../../logger'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V1CredentialService } from '../V1CredentialService'

import { OutboundMessageContext } from '../../../../../agent/models'
import { V1ProposeCredentialMessage } from '../messages'

export class V1ProposeCredentialHandler implements MessageHandler {
  private credentialService: V1CredentialService
  private logger: Logger
  public supportedMessages = [V1ProposeCredentialMessage]

  public constructor(credentialService: V1CredentialService, logger: Logger) {
    this.credentialService = credentialService
    this.logger = logger
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V1ProposeCredentialHandler>) {
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
    messageContext: MessageHandlerInboundMessage<V1ProposeCredentialHandler>
  ) {
    this.logger.info(`Automatically sending offer with autoAccept`)

    if (!messageContext.connection) {
      this.logger.error('No connection on the messageContext, aborting auto accept')
      return
    }

    const { message } = await this.credentialService.acceptProposal(messageContext.agentContext, {
      credentialRecord,
    })

    return new OutboundMessageContext(message, {
      agentContext: messageContext.agentContext,
      connection: messageContext.connection,
      associatedRecord: credentialRecord,
    })
  }
}
