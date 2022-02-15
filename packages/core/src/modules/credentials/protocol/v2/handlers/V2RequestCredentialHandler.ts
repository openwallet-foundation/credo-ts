/* eslint-disable @typescript-eslint/no-unused-vars */
import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler } from '../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { CredentialResponseCoordinator } from '../../../CredentialResponseCoordinator'
import type { AcceptRequestOptions } from '../../../interfaces'
import type { CredentialExchangeRecord } from '../../../repository'
import type { V2CredentialService } from '../V2CredentialService'
import type { CredentialFormatService } from '../formats/CredentialFormatService'

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
  private credentialAutoResponseCoordinator: CredentialResponseCoordinator
  private requestMessage: V2RequestCredentialMessage | undefined
  private offerMessage: V2OfferCredentialMessage | undefined
  private proposeMessage: V2ProposeCredentialMessage | undefined
  private didCommMessageRepository: DidCommMessageRepository
  public supportedMessages = [V2RequestCredentialMessage]

  public constructor(
    credentialService: V2CredentialService,
    agentConfig: AgentConfig,
    responseCoordinator: CredentialResponseCoordinator,
    didCommMessageRepostitory: DidCommMessageRepository
  ) {
    this.credentialAutoResponseCoordinator = responseCoordinator
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.didCommMessageRepository = didCommMessageRepostitory
  }

  public async handle(messageContext: InboundMessageContext<V2RequestCredentialMessage>) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    logger.debug('----------------------------- >>>>TEST-DEBUG WE ARE IN THE v2 HANDLER FOR REQUEST CREDENTIAL')
    const credentialRecord = await this.credentialService.processRequest(messageContext)

    try {
      this.requestMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2RequestCredentialMessage,
      })
    } catch (NoRecordFoundError) {
      // can happen in normal processing
    }

    try {
      this.offerMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2OfferCredentialMessage,
      })
    } catch (NoRecordFoundError) {
      // can happen in normal processing *in W3C*)
    }
    try {
      this.proposeMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2ProposeCredentialMessage,
      })
    } catch (NoRecordFoundError) {
      // can happen in normal processing
    }
    if (!this.requestMessage) {
      throw Error('Missing request message in V2OfferCredentialHandler')
    }
    // 1. Get all formats for this message
    const formatServices: CredentialFormatService[] = this.credentialService.getFormatsFromMessage(
      this.requestMessage.formats
    )

    // 2. loop through found formats
    let shouldAutoRespond = true
    for (const formatService of formatServices) {
      // 3. Call format.shouldRespondToProposal for each one
      const formatShouldAutoRespond = formatService.shouldAutoRespondToRequest(
        credentialRecord,
        this.agentConfig.autoAcceptCredentials,
        this.requestMessage,
        this.proposeMessage,
        this.offerMessage
      )
      shouldAutoRespond = shouldAutoRespond && formatShouldAutoRespond
    }

    logger.debug('----------------->>> REQUEST HANDLER shouldAutoRespond = ' + shouldAutoRespond)
    // 4. if all formats are eligibile for auto response then call create offer
    if (shouldAutoRespond) {
      return await this.createCredential(credentialRecord, messageContext)
    }
  }

  private async createCredential(
    record: CredentialExchangeRecord,
    messageContext: InboundMessageContext<V2RequestCredentialMessage>
  ) {
    this.agentConfig.logger.info(
      `Automatically sending credential with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )
    const options: AcceptRequestOptions = {
      comment: this.requestMessage?.comment,
      autoAcceptCredential: record.autoAcceptCredential,
      protocolVersion: CredentialProtocolVersion.V2_0,
      credentialRecordId: record.id,
    }

    const { message, credentialRecord } = await this.credentialService.createCredential(record, options)
    if (messageContext.connection) {
      logger.debug('Sending ISSUE CREDENTIAL message: ' + message)

      return createOutboundMessage(messageContext.connection, message)
    } else if (this.requestMessage?.service && this.offerMessage?.service) {
      const recipientService = this.requestMessage.service
      const ourService = this.offerMessage.service

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
