import type { MessageHandler } from '../../../../../agent/MessageHandler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { CredentialExchangeRecord } from '../../../repository'
import type { V2CredentialProtocol } from '../V2CredentialProtocol'

import { OutboundMessageContext } from '../../../../../agent/models'
import { DidCommMessageRepository, DidCommMessageRole } from '../../../../../storage'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'
import { V2RequestCredentialMessage } from '../messages/V2RequestCredentialMessage'

export class V2RequestCredentialHandler implements MessageHandler {
  private credentialProtocol: V2CredentialProtocol

  public supportedMessages = [V2RequestCredentialMessage]

  public constructor(credentialProtocol: V2CredentialProtocol) {
    this.credentialProtocol = credentialProtocol
  }

  public async handle(messageContext: InboundMessageContext<V2RequestCredentialMessage>) {
    const credentialRecord = await this.credentialProtocol.processRequest(messageContext)

    const shouldAutoRespond = await this.credentialProtocol.shouldAutoRespondToRequest(messageContext.agentContext, {
      credentialRecord,
      requestMessage: messageContext.message,
    })

    if (shouldAutoRespond) {
      return await this.acceptRequest(credentialRecord, messageContext)
    }
  }

  private async acceptRequest(
    credentialRecord: CredentialExchangeRecord,
    messageContext: InboundMessageContext<V2RequestCredentialMessage>
  ) {
    messageContext.agentContext.config.logger.info(`Automatically sending credential with autoAccept`)
    const didCommMessageRepository = messageContext.agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const offerMessage = await didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
      associatedRecordId: credentialRecord.id,
      messageClass: V2OfferCredentialMessage,
    })

    const { message } = await this.credentialProtocol.acceptRequest(messageContext.agentContext, {
      credentialRecord,
    })

    if (messageContext.connection) {
      return new OutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
        connection: messageContext.connection,
        associatedRecord: credentialRecord,
      })
    } else if (messageContext.message.service && offerMessage?.service) {
      const recipientService = messageContext.message.service
      const ourService = offerMessage.service

      // Set ~service, update message in record (for later use)
      message.setService(ourService)
      await didCommMessageRepository.saveOrUpdateAgentMessage(messageContext.agentContext, {
        agentMessage: message,
        associatedRecordId: credentialRecord.id,
        role: DidCommMessageRole.Sender,
      })

      return new OutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
        serviceParams: {
          service: recipientService.resolvedDidCommService,
          senderKey: ourService.resolvedDidCommService.recipientKeys[0],
        },
      })
    }

    messageContext.agentContext.config.logger.error(`Could not automatically issue credential`)
  }
}
