import type { Attachment } from '../../../../../../src/decorators/attachment/Attachment'
import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { HandlerAutoAcceptOptions } from '../../../formats/models/CredentialFormatServiceOptions'
import type { CredentialPreviewAttribute } from '../../../models/CredentialPreviewAttributes'
import type { CredentialExchangeRecord } from '../../../repository/CredentialRecord'
import type { V1CredentialService } from '../V1CredentialService'
import type { CredOffer } from 'indy-sdk'

import { createOutboundMessage } from '../../../../../agent/helpers'
import { AriesFrameworkError } from '../../../../../error/AriesFrameworkError'
import { AutoAcceptCredential } from '../../../CredentialAutoAcceptType'
import { CredentialResponseCoordinator } from '../../../CredentialResponseCoordinator'
import { CredentialUtils } from '../../../CredentialUtils'
import { V1OfferCredentialMessage, V1ProposeCredentialMessage } from '../messages'

interface V1HandlerAutoAcceptOptions extends HandlerAutoAcceptOptions {
  credentialDefinitionId?: string
}

export class V1ProposeCredentialHandler implements Handler {
  private credentialService: V1CredentialService
  private agentConfig: AgentConfig
  private didCommMessageRepository: DidCommMessageRepository
  public supportedMessages = [V1ProposeCredentialMessage]

  public constructor(
    credentialService: V1CredentialService,
    agentConfig: AgentConfig,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: HandlerInboundMessage<V1ProposeCredentialHandler>) {
    const credentialRecord = await this.credentialService.processProposal(messageContext)

    // note that these two messages can be present (or not) and there is no
    // guarantee which one is present so we need two try-catch blocks
    const proposalMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1ProposeCredentialMessage,
    })

    const offerMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1OfferCredentialMessage,
    })

    let proposalValues: CredentialPreviewAttribute[] | undefined

    if (!proposalMessage || !proposalMessage.credentialProposal || !proposalMessage.credentialProposal.attributes) {
      throw new AriesFrameworkError('Missing attributes in proposal message')
    }
    let proposalAttachment, offerAttachment: Attachment | undefined
    if (proposalMessage && proposalMessage.appendedAttachments) {
      proposalValues = proposalMessage.credentialProposal.attributes
    }
    if (offerMessage) {
      offerAttachment = offerMessage.getAttachmentById('indy')
    }
    const handlerOptions: V1HandlerAutoAcceptOptions = {
      credentialRecord,
      autoAcceptType: this.agentConfig.autoAcceptCredentials,
      messageAttributes: proposalValues,
      proposalAttachment,
      offerAttachment,
      credentialDefinitionId: proposalMessage.credentialDefinitionId,
    }
    if (this.shouldAutoRespondToProposal(handlerOptions)) {
      return await this.createOffer(credentialRecord, messageContext, proposalMessage)
    }
  }

  public shouldAutoRespondToProposal(handlerOptions: V1HandlerAutoAcceptOptions): boolean {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      handlerOptions.credentialRecord.autoAcceptCredential,
      handlerOptions.autoAcceptType
    )

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return (
        this.areProposalValuesValid(handlerOptions.credentialRecord, handlerOptions.messageAttributes) &&
        this.areProposalAndOfferDefinitionIdEqual(handlerOptions.credentialDefinitionId, handlerOptions.offerAttachment)
      )
    }
    return false
  }
  private areProposalValuesValid(
    credentialRecord: CredentialExchangeRecord,
    proposeMessageAttributes?: CredentialPreviewAttribute[]
  ) {
    const { credentialAttributes } = credentialRecord

    if (proposeMessageAttributes && credentialAttributes) {
      const proposeValues = CredentialUtils.convertAttributesToValues(proposeMessageAttributes)
      const defaultValues = CredentialUtils.convertAttributesToValues(credentialAttributes)
      if (CredentialUtils.checkValuesMatch(proposeValues, defaultValues)) {
        return true
      }
    }
    return false
  }
  private areProposalAndOfferDefinitionIdEqual(proposalCredentialDefinitionId?: string, offerAttachment?: Attachment) {
    let credOffer: CredOffer | undefined

    if (offerAttachment) {
      credOffer = offerAttachment.getDataAsJson<CredOffer>()
    }
    const offerCredentialDefinitionId = credOffer?.cred_def_id
    return proposalCredentialDefinitionId === offerCredentialDefinitionId
  }

  private async createOffer(
    credentialRecord: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<V1ProposeCredentialHandler>,
    proposalMessage?: V1ProposeCredentialMessage
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
        `Proposal message with id ${credentialRecord.id} is missing required credential proposal`
      )
      return
    }

    if (!proposalMessage.credentialDefinitionId) {
      this.agentConfig.logger.error('Missing required credential definition id')
      return
    }

    const { message } = await this.credentialService.createOfferAsResponse(credentialRecord, {
      credentialDefinitionId: proposalMessage.credentialDefinitionId,
      preview: proposalMessage.credentialProposal,
    })
    return createOutboundMessage(messageContext.connection, message)
  }
}
