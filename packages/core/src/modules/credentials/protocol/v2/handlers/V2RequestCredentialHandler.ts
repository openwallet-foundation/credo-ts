import type { Attachment } from '../../../../../../src/decorators/attachment/Attachment'
import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler } from '../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { CredentialFormatService } from '../../../formats/CredentialFormatService'
import type { HandlerAutoAcceptOptions } from '../../../formats/models/CredentialFormatServiceOptions'
import type { AcceptRequestOptions } from '../../../interfaces'
import type { CredentialExchangeRecord } from '../../../repository'
import type { V2CredentialService } from '../V2CredentialService'

import { AriesFrameworkError } from '../../../../../../src/error/AriesFrameworkError'
import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
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
    didCommMessageRepostitory: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.didCommMessageRepository = didCommMessageRepostitory
  }

  public async handle(messageContext: InboundMessageContext<V2RequestCredentialMessage>) {
    const credentialRecord = await this.credentialService.processRequest(messageContext)

    const requestMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2RequestCredentialMessage,
    })

    const offerMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2OfferCredentialMessage,
    })

    const proposeMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2ProposeCredentialMessage,
    })

    if (!requestMessage) {
      throw new AriesFrameworkError('Missing request message in V2OfferCredentialHandler')
    }
    const formatServices: CredentialFormatService[] = this.credentialService.getFormatsFromMessage(
      requestMessage.formats
    )
    let shouldAutoRespond = true

    for (const formatService of formatServices) {
      let proposalAttachment, offerAttachment, requestAttachment: Attachment | undefined
      if (proposeMessage) {
        proposalAttachment = formatService.getAttachment(proposeMessage)
      }
      if (offerMessage) {
        offerAttachment = formatService.getAttachment(offerMessage)
      }
      if (requestMessage) {
        requestAttachment = formatService.getAttachment(requestMessage)
      }
      const handlerOptions: HandlerAutoAcceptOptions = {
        credentialRecord,
        autoAcceptType: this.agentConfig.autoAcceptCredentials,
        proposalAttachment,
        offerAttachment,
        requestAttachment,
      }
      const formatShouldAutoRespond = formatService.shouldAutoRespondToRequest(handlerOptions)
      shouldAutoRespond = shouldAutoRespond && formatShouldAutoRespond
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
      this.agentConfig.logger.debug('Sending ISSUE CREDENTIAL message: ' + message)

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
