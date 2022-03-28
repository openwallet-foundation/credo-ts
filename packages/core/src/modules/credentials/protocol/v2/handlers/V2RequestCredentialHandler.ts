import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler } from '../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { AcceptRequestOptions } from '../../../CredentialsModuleOptions'
import type { CredentialExchangeRecord } from '../../../repository'
import type { V2CredentialService } from '../V2CredentialService'

import { AriesFrameworkError } from '../../../../../../src/error/AriesFrameworkError'
import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { AutoAcceptCredential } from '../../../CredentialAutoAcceptType'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'
import { V2ProposeCredentialMessage } from '../messages/V2ProposeCredentialMessage'
import { V2RequestCredentialMessage } from '../messages/V2RequestCredentialMessage'

export class V2RequestCredentialHandler implements Handler {
  private credentialService: V2CredentialService
  private agentConfig: AgentConfig
  private didCommMessageRepository: DidCommMessageRepository
  public supportedMessages = [V2RequestCredentialMessage]

  public constructor(
    credentialService: V2CredentialService,
    agentConfig: AgentConfig,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: InboundMessageContext<V2RequestCredentialMessage>) {
    const credentialRecord = await this.credentialService.processRequest(messageContext)
    let requestMessage
    try {
      requestMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2RequestCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      throw new AriesFrameworkError('Missing request message in V2RequestCredentialHandler')
    }

    const offerMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2OfferCredentialMessage,
    })

    const proposeMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2ProposeCredentialMessage,
    })

    let shouldAutoRespond

    if (this.agentConfig.autoAcceptCredentials === AutoAcceptCredential.Never) {
      shouldAutoRespond = false
    } else {
      shouldAutoRespond = this.credentialService.shouldAutoRespondToRequest(
        credentialRecord,
        requestMessage,
        proposeMessage ? proposeMessage : undefined,
        offerMessage ? offerMessage : undefined
      )
    }

    if (shouldAutoRespond) {
      return await this.createCredential(credentialRecord, messageContext, requestMessage, offerMessage)
    }
  }

  private async createCredential(
    record: CredentialExchangeRecord,
    messageContext: InboundMessageContext<V2RequestCredentialMessage>,
    requestMessage: V2RequestCredentialMessage,
    offerMessage?: V2OfferCredentialMessage | null
  ) {
    this.agentConfig.logger.info(
      `Automatically sending credential with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )
    const options: AcceptRequestOptions = {
      comment: requestMessage.comment,
      autoAcceptCredential: record.autoAcceptCredential,
      credentialRecordId: record.id,
    }

    const { message, credentialRecord } = await this.credentialService.createCredential(record, options)
    if (messageContext.connection) {
      return createOutboundMessage(messageContext.connection, message)
    } else if (requestMessage.service && offerMessage?.service) {
      const recipientService = requestMessage.service
      const ourService = offerMessage.service

      // Set ~service, update message in record (for later use)
      message.setService(ourService)
      await this.credentialService.update(credentialRecord)

      return createOutboundServiceMessage({
        payload: message,
        service: recipientService.toDidCommService(),
        senderKey: ourService.recipientKeys[0],
      })
    }
    this.agentConfig.logger.error(`Could not automatically create credential request`)
  }
}
