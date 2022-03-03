import type { CredentialExchangeRecord } from '../../..'
import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { CredentialFormatService } from '../../../formats/CredentialFormatService'
import type { CredProposeOfferRequestFormat } from '../../../formats/models/CredentialFormatServiceOptions'
import type { AcceptProposalOptions } from '../../../interfaces'
import type { CredentialPreviewAttribute } from '../../../models/CredentialPreviewAttributes'
import type { V2CredentialService } from '../V2CredentialService'

import { createOutboundMessage } from '../../../../../agent/helpers'
import { ConsoleLogger, LogLevel } from '../../../../../logger'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'
import { V2ProposeCredentialMessage } from '../messages/V2ProposeCredentialMessage'

const logger = new ConsoleLogger(LogLevel.info)

export class V2ProposeCredentialHandler implements Handler {
  private credentialService: V2CredentialService
  private agentConfig: AgentConfig
  private didCommMessageRepository: DidCommMessageRepository

  public supportedMessages = [V2ProposeCredentialMessage]

  public constructor(
    credentialService: V2CredentialService,
    agentConfig: AgentConfig,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: InboundMessageContext<V2ProposeCredentialMessage>) {
    logger.debug('----------------------------- >>>>TEST-DEBUG WE ARE IN THE v2 HANDLER FOR PROPOSE CREDENTIAL')
    const credentialRecord = await this.credentialService.processProposal(messageContext)

    let proposalMessage: V2ProposeCredentialMessage | undefined
    let offerMessage: V2OfferCredentialMessage | undefined
    try {
      proposalMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2ProposeCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      throw Error('No propose message found in DidCommMessageRepository')
    }
    try {
      offerMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2OfferCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      // can happen sometimes
    }

    // 1. Get all formats for this message
    const formatServices: CredentialFormatService[] = this.credentialService.getFormatsFromMessage(
      proposalMessage.formats
    )

    // 2. loop through found formats
    let shouldAutoRespond = true
    let offerPayload: CredProposeOfferRequestFormat | undefined
    let proposalPayload: CredProposeOfferRequestFormat | undefined
    let proposalValues: CredentialPreviewAttribute[] | undefined
    for (const formatService of formatServices) {
      // 3. Call format.shouldRespondToProposal for each one

      if (!proposalMessage.credentialProposal || !proposalMessage.credentialProposal.attributes) {
        throw Error('Missing attributes in proposal message')
      }
      if (proposalMessage) {
        proposalValues = proposalMessage.credentialProposal.attributes
        const attachment = this.credentialService.getAttachment(proposalMessage)
        if (attachment) {
          proposalPayload = formatService.getCredentialPayload(attachment)
        }
      }
      if (offerMessage) {
        const attachment = this.credentialService.getAttachment(offerMessage)
        if (attachment) {
          offerPayload = formatService.getCredentialPayload(attachment)
        }
      }
      const formatShouldAutoRespond = formatService.shouldAutoRespondToProposal(
        credentialRecord,
        this.agentConfig.autoAcceptCredentials,
        proposalValues,
        proposalPayload,
        offerPayload
      )
      shouldAutoRespond = shouldAutoRespond && formatShouldAutoRespond
      // 4. if all formats are eligibile for auto response then call create offer
      if (shouldAutoRespond) {
        return await this.createOffer(credentialRecord, messageContext, proposalMessage)
      }
    }
  }

  private async createOffer(
    credentialRecord: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<V2ProposeCredentialHandler>,
    proposalMessage?: V2ProposeCredentialMessage
  ) {
    this.agentConfig.logger.info(
      `Automatically sending offer with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )

    if (!messageContext.connection) {
      this.agentConfig.logger.error('No connection on the messageContext, aborting auto accept')
      return
    }

    if (!proposalMessage?.credentialProposal) {
      this.agentConfig.logger.error(
        `Credential record with id ${credentialRecord.id} is missing required credential proposal`
      )
      return
    }

    const options: AcceptProposalOptions = await this.credentialService.createAcceptProposalOptions(credentialRecord)
    options.offerAttachment = this.credentialService.getAttachment(proposalMessage)
    const message = await this.credentialService.createOfferAsResponse(credentialRecord, options)
    return createOutboundMessage(messageContext.connection, message)
  }
}
