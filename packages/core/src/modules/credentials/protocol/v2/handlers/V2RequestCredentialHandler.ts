/* eslint-disable @typescript-eslint/no-unused-vars */
import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler } from '../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { CredentialFormatService, CredProposeOfferRequestFormat } from '../../../formats/CredentialFormatService'
import type { AcceptRequestOptions } from '../../../interfaces'
import type { CredentialExchangeRecord } from '../../../repository'
import type { V2CredentialService } from '../V2CredentialService'

import { ConsoleLogger, LogLevel } from '../../../../../../src/logger'
import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { DidCommMessageRole } from '../../../../../storage'
import { CredentialProtocolVersion } from '../../../CredentialProtocolVersion'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'
import { V2ProposeCredentialMessage } from '../messages/V2ProposeCredentialMessage'
import { V2RequestCredentialMessage } from '../messages/V2RequestCredentialMessage'

const logger = new ConsoleLogger(LogLevel.debug)

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    logger.debug('----------------------------- >>>>TEST-DEBUG WE ARE IN THE v2 HANDLER FOR REQUEST CREDENTIAL')
    const credentialRecord = await this.credentialService.processRequest(messageContext)

    let requestMessage: V2RequestCredentialMessage | undefined
    let offerMessage: V2OfferCredentialMessage | undefined
    let proposeMessage: V2ProposeCredentialMessage | undefined
    try {
      requestMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2RequestCredentialMessage,
      })
    } catch (NoRecordFoundError) {
      // can happen in normal processing
    }

    try {
      offerMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2OfferCredentialMessage,
      })
    } catch (NoRecordFoundError) {
      // can happen in normal processing *in W3C*)
    }
    try {
      proposeMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2ProposeCredentialMessage,
      })
    } catch (NoRecordFoundError) {
      // can happen in normal processing
    }
    if (!requestMessage) {
      throw Error('Missing request message in V2OfferCredentialHandler')
    }
    // 1. Get all formats for this message
    const formatServices: CredentialFormatService[] = this.credentialService.getFormatsFromMessage(
      requestMessage.formats
    )

    // 2. loop through found formats
    let shouldAutoRespond = true
    let offerPayload: CredProposeOfferRequestFormat | undefined
    let proposalPayload: CredProposeOfferRequestFormat | undefined
    let requestPayload: CredProposeOfferRequestFormat | undefined

    for (const formatService of formatServices) {
      // 3. Call format.shouldRespondToProposal for each one
      if (proposeMessage) {
        const attachment = formatService.getAttachment(proposeMessage)
        if (attachment) {
          proposalPayload = formatService.getCredentialPayload(attachment)
        }
      }
      if (offerMessage) {
        const attachment = formatService.getAttachment(offerMessage)
        if (attachment) {
          offerPayload = formatService.getCredentialPayload(attachment)
        }
      }
      const attachment = formatService.getAttachment(requestMessage)
      if (attachment) {
        requestPayload = formatService.getCredentialPayload(attachment)

        const formatShouldAutoRespond = formatService.shouldAutoRespondToRequestNEW(
          credentialRecord,
          this.agentConfig.autoAcceptCredentials,
          requestPayload,
          offerPayload,
          proposalPayload
        )
        shouldAutoRespond = shouldAutoRespond && formatShouldAutoRespond
      }

      logger.debug('----------------->>> REQUEST HANDLER shouldAutoRespond = ' + shouldAutoRespond)
      // 4. if all formats are eligibile for auto response then call create offer
      if (shouldAutoRespond) {
        return await this.createCredential(credentialRecord, messageContext, requestMessage, offerMessage)
      }
    }
  }

  private async createCredential(
    record: CredentialExchangeRecord,
    messageContext: InboundMessageContext<V2RequestCredentialMessage>,
    requestMessage: V2RequestCredentialMessage,
    offerMessage?: V2OfferCredentialMessage
  ) {
    this.agentConfig.logger.info(
      `Automatically sending credential with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )
    const options: AcceptRequestOptions = {
      comment: requestMessage.comment,
      autoAcceptCredential: record.autoAcceptCredential,
      protocolVersion: CredentialProtocolVersion.V2_0,
      credentialRecordId: record.id,
    }

    const { message, credentialRecord } = await this.credentialService.createCredential(record, options)
    if (messageContext.connection) {
      logger.debug('Sending ISSUE CREDENTIAL message: ' + message)

      return createOutboundMessage(messageContext.connection, message)
    } else if (requestMessage.service && offerMessage?.service) {
      const recipientService = requestMessage.service
      const ourService = offerMessage.service

      // Set ~service, update message in record (for later use)
      message.setService(ourService)
      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: message,
        role: DidCommMessageRole.Sender,
        associatedRecordId: credentialRecord.id,
      })
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
