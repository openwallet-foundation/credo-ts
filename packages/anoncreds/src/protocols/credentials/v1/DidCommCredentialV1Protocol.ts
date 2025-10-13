import type { AgentContext } from '@credo-ts/core'
import { CredoError, JsonTransformer, utils } from '@credo-ts/core'
import type {
  CredentialProtocolOptions,
  DidCommCredentialProtocol,
  DidCommFeatureRegistry,
  DidCommInboundMessageContext,
  DidCommMessage,
  DidCommMessageHandlerRegistry,
  DidCommProblemReportMessage,
  ExtractCredentialFormats,
} from '@credo-ts/didcomm'
import {
  AckStatus,
  BaseDidCommCredentialProtocol,
  DidCommAttachment,
  DidCommAttachmentData,
  DidCommAutoAcceptCredential,
  DidCommConnectionService,
  DidCommCredentialExchangeRecord,
  DidCommCredentialExchangeRepository,
  DidCommCredentialProblemReportReason,
  DidCommCredentialRole,
  DidCommCredentialState,
  DidCommCredentialsModuleConfig,
  DidCommMessageRepository,
  DidCommMessageRole,
  DidCommProtocol,
  isLinkedAttachment,
} from '@credo-ts/didcomm'
import type { LegacyIndyDidCommCredentialFormatService } from '../../../formats'

import { AnonCredsCredentialProposal } from '../../../models/AnonCredsCredentialProposal'
import { areCredentialPreviewAttributesEqual, composeCredentialAutoAccept } from '../../../utils'

import {
  DidCommCredentialV1AckHandler,
  DidCommCredentialV1ProblemReportHandler,
  DidCommIssueCredentialV1Handler,
  DidCommOfferCredentialV1Handler,
  DidCommProposeCredentialV1Handler,
  DidCommRequestCredentialV1Handler,
} from './handlers'
import {
  DidCommCredentialV1AckMessage,
  DidCommCredentialV1Preview,
  DidCommCredentialV1ProblemReportMessage,
  DidCommIssueCredentialV1Message,
  DidCommProposeCredentialV1Message,
  DidCommRequestCredentialV1Message,
  INDY_CREDENTIAL_ATTACHMENT_ID,
  INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
  INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
  V1OfferCredentialMessage,
} from './messages'

export interface DidCommCredentialV1ProtocolConfig {
  indyCredentialFormat: LegacyIndyDidCommCredentialFormatService
}

export class DidCommCredentialV1Protocol
  extends BaseDidCommCredentialProtocol<[LegacyIndyDidCommCredentialFormatService]>
  implements DidCommCredentialProtocol<[LegacyIndyDidCommCredentialFormatService]>
{
  private indyCredentialFormat: LegacyIndyDidCommCredentialFormatService

  public constructor({ indyCredentialFormat }: DidCommCredentialV1ProtocolConfig) {
    super()

    // TODO: just create a new instance of LegacyIndyDidCommCredentialFormatService here so it makes the setup easier
    this.indyCredentialFormat = indyCredentialFormat
  }

  /**
   * The version of the issue credential protocol this protocol supports
   */
  public readonly version = 'v1'

  /**
   * Registers the protocol implementation (handlers, feature registry) on the agent.
   */
  public register(messageHandlerRegistry: DidCommMessageHandlerRegistry, featureRegistry: DidCommFeatureRegistry) {
    // Register message handlers for the Issue Credential V1 Protocol
    messageHandlerRegistry.registerMessageHandlers([
      new DidCommProposeCredentialV1Handler(this),
      new DidCommOfferCredentialV1Handler(this),
      new DidCommRequestCredentialV1Handler(this),
      new DidCommIssueCredentialV1Handler(this),
      new DidCommCredentialV1AckHandler(this),
      new DidCommCredentialV1ProblemReportHandler(this),
    ])

    // Register Issue Credential V1 in feature registry, with supported roles
    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/issue-credential/1.0',
        roles: ['holder', 'issuer'],
      })
    )
  }

  /**
   * Create a {@link ProposeCredentialMessage} not bound to an existing credential exchange.
   * To create a proposal as response to an existing credential exchange, use {@link createProposalAsResponse}.
   *
   * @param options The object containing config options
   * @returns Object containing proposal message and associated credential record
   *
   */
  public async createProposal(
    agentContext: AgentContext,
    {
      connectionRecord,
      credentialFormats,
      comment,
      autoAcceptCredential,
    }: CredentialProtocolOptions.CreateCredentialProposalOptions<[LegacyIndyDidCommCredentialFormatService]>
  ): Promise<CredentialProtocolOptions.CredentialProtocolMsgReturnType<DidCommMessage>> {
    this.assertOnlyIndyFormat(credentialFormats)

    const credentialRepository = agentContext.dependencyManager.resolve(DidCommCredentialExchangeRepository)
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    if (!credentialFormats.indy) {
      throw new CredoError('Missing indy credential format in v1 create proposal call.')
    }

    // TODO: linked attachments are broken currently. We never include them in the messages.
    // The linking with previews does work, so it shouldn't be too much work to re-enable this.
    const { linkedAttachments } = credentialFormats.indy

    // Create record
    const credentialExchangeRecord = new DidCommCredentialExchangeRecord({
      connectionId: connectionRecord.id,
      threadId: utils.uuid(),
      state: DidCommCredentialState.ProposalSent,
      role: DidCommCredentialRole.Holder,
      linkedAttachments: linkedAttachments?.map((linkedAttachment) => linkedAttachment.attachment),
      autoAcceptCredential,
      protocolVersion: 'v1',
    })

    // call create proposal for validation of the proposal and addition of linked attachments
    const { previewAttributes, attachment } = await this.indyCredentialFormat.createProposal(agentContext, {
      credentialFormats,
      credentialExchangeRecord,
    })

    // Transform the attachment into the attachment payload and use that to construct the v1 message
    const indyCredentialProposal = JsonTransformer.fromJSON(attachment.getDataAsJson(), AnonCredsCredentialProposal)

    const credentialProposal = previewAttributes
      ? new DidCommCredentialV1Preview({
          attributes: previewAttributes,
        })
      : undefined

    // Create message
    const message = new DidCommProposeCredentialV1Message({
      ...indyCredentialProposal,
      id: credentialExchangeRecord.threadId,
      credentialPreview: credentialProposal,
      comment,
    })

    await didCommMessageRepository.saveAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialExchangeRecord.id,
    })

    credentialExchangeRecord.credentialAttributes = credentialProposal?.attributes
    await credentialRepository.save(agentContext, credentialExchangeRecord)
    this.emitStateChangedEvent(agentContext, credentialExchangeRecord, null)

    return { credentialExchangeRecord, message }
  }

  /**
   * Process a received {@link ProposeCredentialMessage}. This will not accept the credential proposal
   * or send a credential offer. It will only create a new, or update the existing credential record with
   * the information from the credential proposal message. Use {@link createOfferAsResponse}
   * after calling this method to create a credential offer.
   *
   * @param messageContext The message context containing a credential proposal message
   * @returns credential record associated with the credential proposal message
   *
   */
  public async processProposal(
    messageContext: DidCommInboundMessageContext<DidCommProposeCredentialV1Message>
  ): Promise<DidCommCredentialExchangeRecord> {
    const { message: proposalMessage, connection, agentContext } = messageContext

    const credentialRepository = agentContext.dependencyManager.resolve(DidCommCredentialExchangeRepository)
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // TODO: with this method, we should update the credential protocol to use the ConnectionApi, so it
    // only depends on the public api, rather than the internal API (this helps with breaking changes)
    const connectionService = agentContext.dependencyManager.resolve(DidCommConnectionService)

    agentContext.config.logger.debug(`Processing credential proposal with message id ${proposalMessage.id}`)

    let credentialExchangeRecord = await this.findByProperties(messageContext.agentContext, {
      threadId: proposalMessage.threadId,
      role: DidCommCredentialRole.Issuer,
      connectionId: connection?.id,
    })

    // Credential record already exists, this is a response to an earlier message sent by us
    if (credentialExchangeRecord) {
      agentContext.config.logger.debug('Credential record already exists for incoming proposal')

      // Assert
      credentialExchangeRecord.assertProtocolVersion('v1')
      credentialExchangeRecord.assertState(DidCommCredentialState.OfferSent)

      const lastReceivedMessage = await didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
        associatedRecordId: credentialExchangeRecord.id,
        messageClass: DidCommProposeCredentialV1Message,
        role: DidCommMessageRole.Receiver,
      })
      const lastSentMessage = await didCommMessageRepository.getAgentMessage(messageContext.agentContext, {
        associatedRecordId: credentialExchangeRecord.id,
        messageClass: V1OfferCredentialMessage,
        role: DidCommMessageRole.Sender,
      })

      await connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
        lastReceivedMessage,
        lastSentMessage,
        expectedConnectionId: credentialExchangeRecord.connectionId,
      })

      await this.indyCredentialFormat.processProposal(messageContext.agentContext, {
        credentialExchangeRecord,
        attachment: new DidCommAttachment({
          data: new DidCommAttachmentData({
            json: JsonTransformer.toJSON(this.rfc0592ProposalFromV1ProposeMessage(proposalMessage)),
          }),
        }),
      })

      // Update record
      await this.updateState(
        messageContext.agentContext,
        credentialExchangeRecord,
        DidCommCredentialState.ProposalReceived
      )
      await didCommMessageRepository.saveOrUpdateAgentMessage(messageContext.agentContext, {
        agentMessage: proposalMessage,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialExchangeRecord.id,
      })
    } else {
      agentContext.config.logger.debug('Credential record does not exists yet for incoming proposal')
      // Assert
      await connectionService.assertConnectionOrOutOfBandExchange(messageContext)

      // No credential record exists with thread id
      credentialExchangeRecord = new DidCommCredentialExchangeRecord({
        connectionId: connection?.id,
        threadId: proposalMessage.threadId,
        state: DidCommCredentialState.ProposalReceived,
        role: DidCommCredentialRole.Issuer,
        protocolVersion: 'v1',
      })

      // Save record
      await credentialRepository.save(messageContext.agentContext, credentialExchangeRecord)
      this.emitStateChangedEvent(messageContext.agentContext, credentialExchangeRecord, null)

      await didCommMessageRepository.saveAgentMessage(messageContext.agentContext, {
        agentMessage: proposalMessage,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialExchangeRecord.id,
      })
    }
    return credentialExchangeRecord
  }

  /**
   * Processing an incoming credential message and create a credential offer as a response
   * @param options The object containing config options
   * @returns Object containing proposal message and associated credential record
   */
  public async acceptProposal(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      credentialFormats,
      comment,
      autoAcceptCredential,
    }: CredentialProtocolOptions.AcceptCredentialProposalOptions<[LegacyIndyDidCommCredentialFormatService]>
  ): Promise<CredentialProtocolOptions.CredentialProtocolMsgReturnType<V1OfferCredentialMessage>> {
    // Assert
    credentialExchangeRecord.assertProtocolVersion('v1')
    credentialExchangeRecord.assertState(DidCommCredentialState.ProposalReceived)
    if (credentialFormats) this.assertOnlyIndyFormat(credentialFormats)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const proposalMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeRecord.id,
      messageClass: DidCommProposeCredentialV1Message,
      role: DidCommMessageRole.Receiver,
    })

    // NOTE: We set the credential attributes from the proposal on the record as we've 'accepted' them
    // and can now use them to create the offer in the format services. It may be overwritten later on
    // if the user provided other attributes in the credentialFormats array.
    credentialExchangeRecord.credentialAttributes = proposalMessage.credentialPreview?.attributes

    const { attachment, previewAttributes } = await this.indyCredentialFormat.acceptProposal(agentContext, {
      attachmentId: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
      credentialFormats,
      credentialExchangeRecord,
      proposalAttachment: new DidCommAttachment({
        data: new DidCommAttachmentData({
          json: JsonTransformer.toJSON(this.rfc0592ProposalFromV1ProposeMessage(proposalMessage)),
        }),
      }),
    })

    if (!previewAttributes) {
      throw new CredoError('Missing required credential preview attributes from indy format service')
    }

    const message = new V1OfferCredentialMessage({
      comment,
      offerAttachments: [attachment],
      credentialPreview: new DidCommCredentialV1Preview({
        attributes: previewAttributes,
      }),
      attachments: credentialExchangeRecord.linkedAttachments,
    })

    message.setThread({
      threadId: credentialExchangeRecord.threadId,
      parentThreadId: credentialExchangeRecord.parentThreadId,
    })

    credentialExchangeRecord.credentialAttributes = message.credentialPreview.attributes
    credentialExchangeRecord.autoAcceptCredential =
      autoAcceptCredential ?? credentialExchangeRecord.autoAcceptCredential
    await this.updateState(agentContext, credentialExchangeRecord, DidCommCredentialState.OfferSent)

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialExchangeRecord.id,
    })

    return { credentialExchangeRecord, message }
  }

  /**
   * Negotiate a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param options configuration for the offer see {@link NegotiateCredentialProposalOptions}
   * @returns Credential record associated with the credential offer and the corresponding new offer message
   *
   */
  public async negotiateProposal(
    agentContext: AgentContext,
    {
      credentialFormats,
      credentialExchangeRecord,
      comment,
      autoAcceptCredential,
    }: CredentialProtocolOptions.NegotiateCredentialProposalOptions<[LegacyIndyDidCommCredentialFormatService]>
  ): Promise<CredentialProtocolOptions.CredentialProtocolMsgReturnType<V1OfferCredentialMessage>> {
    // Assert
    credentialExchangeRecord.assertProtocolVersion('v1')
    credentialExchangeRecord.assertState(DidCommCredentialState.ProposalReceived)
    this.assertOnlyIndyFormat(credentialFormats)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const { attachment, previewAttributes } = await this.indyCredentialFormat.createOffer(agentContext, {
      attachmentId: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
      credentialFormats,
      credentialExchangeRecord,
    })

    if (!previewAttributes) {
      throw new CredoError('Missing required credential preview attributes from indy format service')
    }

    const message = new V1OfferCredentialMessage({
      comment,
      offerAttachments: [attachment],
      credentialPreview: new DidCommCredentialV1Preview({
        attributes: previewAttributes,
      }),
      attachments: credentialExchangeRecord.linkedAttachments,
    })
    message.setThread({
      threadId: credentialExchangeRecord.threadId,
      parentThreadId: credentialExchangeRecord.parentThreadId,
    })

    credentialExchangeRecord.credentialAttributes = message.credentialPreview.attributes
    credentialExchangeRecord.autoAcceptCredential =
      autoAcceptCredential ?? credentialExchangeRecord.autoAcceptCredential
    await this.updateState(agentContext, credentialExchangeRecord, DidCommCredentialState.OfferSent)

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialExchangeRecord.id,
    })

    return { credentialExchangeRecord, message }
  }

  /**
   * Create a {@link OfferCredentialMessage} not bound to an existing credential exchange.
   * To create an offer as response to an existing credential exchange, use {@link DidCommCredentialV1Protocol#createOfferAsResponse}.
   *
   * @param options The options containing config params for creating the credential offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOffer(
    agentContext: AgentContext,
    {
      credentialFormats,
      autoAcceptCredential,
      comment,
      connectionRecord,
    }: CredentialProtocolOptions.CreateCredentialOfferOptions<[LegacyIndyDidCommCredentialFormatService]>
  ): Promise<CredentialProtocolOptions.CredentialProtocolMsgReturnType<V1OfferCredentialMessage>> {
    // Assert
    this.assertOnlyIndyFormat(credentialFormats)

    const credentialRepository = agentContext.dependencyManager.resolve(DidCommCredentialExchangeRepository)
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    if (!credentialFormats.indy) {
      throw new CredoError('Missing indy credential format data for v1 create offer')
    }

    // Create record
    const credentialExchangeRecord = new DidCommCredentialExchangeRecord({
      connectionId: connectionRecord?.id,
      threadId: utils.uuid(),
      linkedAttachments: credentialFormats.indy.linkedAttachments?.map(
        (linkedAttachments) => linkedAttachments.attachment
      ),
      state: DidCommCredentialState.OfferSent,
      role: DidCommCredentialRole.Issuer,
      autoAcceptCredential,
      protocolVersion: 'v1',
    })

    const { attachment, previewAttributes } = await this.indyCredentialFormat.createOffer(agentContext, {
      attachmentId: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
      credentialFormats,
      credentialExchangeRecord,
    })

    if (!previewAttributes) {
      throw new CredoError('Missing required credential preview from indy format service')
    }

    // Construct offer message
    const message = new V1OfferCredentialMessage({
      id: credentialExchangeRecord.threadId,
      credentialPreview: new DidCommCredentialV1Preview({
        attributes: previewAttributes,
      }),
      comment,
      offerAttachments: [attachment],
      attachments: credentialFormats.indy.linkedAttachments?.map((linkedAttachments) => linkedAttachments.attachment),
    })

    await didCommMessageRepository.saveAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeRecord.id,
      agentMessage: message,
      role: DidCommMessageRole.Sender,
    })

    credentialExchangeRecord.credentialAttributes = message.credentialPreview.attributes
    await credentialRepository.save(agentContext, credentialExchangeRecord)
    this.emitStateChangedEvent(agentContext, credentialExchangeRecord, null)

    return { message, credentialExchangeRecord }
  }

  /**
   * Process a received {@link OfferCredentialMessage}. This will not accept the credential offer
   * or send a credential request. It will only create a new credential record with
   * the information from the credential offer message. Use {@link createRequest}
   * after calling this method to create a credential request.
   *
   * @param messageContext The message context containing a credential request message
   * @returns credential record associated with the credential offer message
   *
   */
  public async processOffer(
    messageContext: DidCommInboundMessageContext<V1OfferCredentialMessage>
  ): Promise<DidCommCredentialExchangeRecord> {
    const { message: offerMessage, connection, agentContext } = messageContext

    const credentialRepository = agentContext.dependencyManager.resolve(DidCommCredentialExchangeRepository)
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // TODO: with this method, we should update the credential protocol to use the ConnectionApi, so it
    // only depends on the public api, rather than the internal API (this helps with breaking changes)
    const connectionService = agentContext.dependencyManager.resolve(DidCommConnectionService)

    agentContext.config.logger.debug(`Processing credential offer with id ${offerMessage.id}`)

    let credentialExchangeRecord = await this.findByProperties(agentContext, {
      threadId: offerMessage.threadId,
      role: DidCommCredentialRole.Holder,
      connectionId: connection?.id,
    })

    const offerAttachment = offerMessage.getOfferAttachmentById(INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)
    if (!offerAttachment) {
      throw new CredoError(`Indy attachment with id ${INDY_CREDENTIAL_OFFER_ATTACHMENT_ID} not found in offer message`)
    }

    if (credentialExchangeRecord) {
      const lastSentMessage = await didCommMessageRepository.getAgentMessage(messageContext.agentContext, {
        associatedRecordId: credentialExchangeRecord.id,
        messageClass: DidCommProposeCredentialV1Message,
        role: DidCommMessageRole.Sender,
      })
      const lastReceivedMessage = await didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
        associatedRecordId: credentialExchangeRecord.id,
        messageClass: V1OfferCredentialMessage,
        role: DidCommMessageRole.Receiver,
      })

      // Assert
      credentialExchangeRecord.assertProtocolVersion('v1')
      credentialExchangeRecord.assertState(DidCommCredentialState.ProposalSent)
      await connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
        lastReceivedMessage,
        lastSentMessage,
        expectedConnectionId: credentialExchangeRecord.connectionId,
      })

      await this.indyCredentialFormat.processOffer(messageContext.agentContext, {
        credentialExchangeRecord,
        attachment: offerAttachment,
      })

      await didCommMessageRepository.saveOrUpdateAgentMessage(messageContext.agentContext, {
        agentMessage: offerMessage,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialExchangeRecord.id,
      })
      await this.updateState(
        messageContext.agentContext,
        credentialExchangeRecord,
        DidCommCredentialState.OfferReceived
      )

      return credentialExchangeRecord
    }
    // Assert
    await connectionService.assertConnectionOrOutOfBandExchange(messageContext)

    // No credential record exists with thread id
    credentialExchangeRecord = new DidCommCredentialExchangeRecord({
      connectionId: connection?.id,
      threadId: offerMessage.threadId,
      parentThreadId: offerMessage.thread?.parentThreadId,
      state: DidCommCredentialState.OfferReceived,
      role: DidCommCredentialRole.Holder,
      protocolVersion: 'v1',
    })

    await this.indyCredentialFormat.processOffer(messageContext.agentContext, {
      credentialExchangeRecord,
      attachment: offerAttachment,
    })

    // Save in repository
    await didCommMessageRepository.saveAgentMessage(messageContext.agentContext, {
      agentMessage: offerMessage,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialExchangeRecord.id,
    })
    await credentialRepository.save(messageContext.agentContext, credentialExchangeRecord)
    this.emitStateChangedEvent(messageContext.agentContext, credentialExchangeRecord, null)

    return credentialExchangeRecord
  }

  /**
   * Create a {@link RequestCredentialMessage} as response to a received credential offer.
   *
   * @param options configuration to use for the credential request
   * @returns Object containing request message and associated credential record
   *
   */
  public async acceptOffer(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      credentialFormats,
      comment,
      autoAcceptCredential,
    }: CredentialProtocolOptions.AcceptCredentialOfferOptions<[LegacyIndyDidCommCredentialFormatService]>
  ): Promise<CredentialProtocolOptions.CredentialProtocolMsgReturnType<DidCommRequestCredentialV1Message>> {
    // Assert credential
    credentialExchangeRecord.assertProtocolVersion('v1')
    credentialExchangeRecord.assertState(DidCommCredentialState.OfferReceived)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const offerMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeRecord.id,
      messageClass: V1OfferCredentialMessage,
      role: DidCommMessageRole.Receiver,
    })

    const offerAttachment = offerMessage.getOfferAttachmentById(INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)
    if (!offerAttachment) {
      throw new CredoError(`Indy attachment with id ${INDY_CREDENTIAL_OFFER_ATTACHMENT_ID} not found in offer message`)
    }

    const { attachment } = await this.indyCredentialFormat.acceptOffer(agentContext, {
      credentialExchangeRecord,
      credentialFormats,
      attachmentId: INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
      offerAttachment,
    })

    const requestMessage = new DidCommRequestCredentialV1Message({
      comment,
      requestAttachments: [attachment],
      attachments: offerMessage.appendedAttachments?.filter((attachment) => isLinkedAttachment(attachment)),
    })
    requestMessage.setThread({
      threadId: credentialExchangeRecord.threadId,
      parentThreadId: credentialExchangeRecord.parentThreadId,
    })

    credentialExchangeRecord.credentialAttributes = offerMessage.credentialPreview.attributes
    credentialExchangeRecord.autoAcceptCredential =
      autoAcceptCredential ?? credentialExchangeRecord.autoAcceptCredential
    credentialExchangeRecord.linkedAttachments = offerMessage.appendedAttachments?.filter((attachment) =>
      isLinkedAttachment(attachment)
    )

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: requestMessage,
      associatedRecordId: credentialExchangeRecord.id,
      role: DidCommMessageRole.Sender,
    })
    await this.updateState(agentContext, credentialExchangeRecord, DidCommCredentialState.RequestSent)

    return { message: requestMessage, credentialExchangeRecord }
  }

  /**
   * Process a received {@link RequestCredentialMessage}. This will not accept the credential request
   * or send a credential. It will only update the existing credential record with
   * the information from the credential request message. Use {@link createCredential}
   * after calling this method to create a credential.
   *
   * @param messageContext The message context containing a credential request message
   * @returns credential record associated with the credential request message
   *
   */
  public async negotiateOffer(
    agentContext: AgentContext,
    {
      credentialFormats,
      credentialExchangeRecord,
      autoAcceptCredential,
      comment,
    }: CredentialProtocolOptions.NegotiateCredentialOfferOptions<[LegacyIndyDidCommCredentialFormatService]>
  ): Promise<CredentialProtocolOptions.CredentialProtocolMsgReturnType<DidCommMessage>> {
    // Assert
    credentialExchangeRecord.assertProtocolVersion('v1')
    credentialExchangeRecord.assertState(DidCommCredentialState.OfferReceived)
    this.assertOnlyIndyFormat(credentialFormats)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    if (!credentialExchangeRecord.connectionId) {
      throw new CredoError(
        `No connectionId found for credential record '${credentialExchangeRecord.id}'. Connection-less issuance does not support negotiation.`
      )
    }

    if (!credentialFormats.indy) {
      throw new CredoError('Missing indy credential format in v1 negotiate proposal call.')
    }

    const { linkedAttachments } = credentialFormats.indy

    // call create proposal for validation of the proposal and addition of linked attachments
    // As the format is different for v1 of the issue credential protocol we won't be using the attachment
    const { previewAttributes, attachment } = await this.indyCredentialFormat.createProposal(agentContext, {
      credentialFormats,
      credentialExchangeRecord,
    })

    // Transform the attachment into the attachment payload and use that to construct the v1 message
    const indyCredentialProposal = JsonTransformer.fromJSON(attachment.getDataAsJson(), AnonCredsCredentialProposal)

    const credentialProposal = previewAttributes
      ? new DidCommCredentialV1Preview({
          attributes: previewAttributes,
        })
      : undefined

    // Create message
    const message = new DidCommProposeCredentialV1Message({
      ...indyCredentialProposal,
      credentialPreview: credentialProposal,
      comment,
    })

    message.setThread({
      threadId: credentialExchangeRecord.threadId,
      parentThreadId: credentialExchangeRecord.parentThreadId,
    })

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialExchangeRecord.id,
    })

    // Update record
    credentialExchangeRecord.credentialAttributes = message.credentialPreview?.attributes
    credentialExchangeRecord.linkedAttachments = linkedAttachments?.map((attachment) => attachment.attachment)
    credentialExchangeRecord.autoAcceptCredential =
      autoAcceptCredential ?? credentialExchangeRecord.autoAcceptCredential
    await this.updateState(agentContext, credentialExchangeRecord, DidCommCredentialState.ProposalSent)

    return { credentialExchangeRecord, message }
  }

  /**
   * Starting from a request is not supported in v1 of the issue credential protocol
   * because indy doesn't allow to start from a request
   */
  public async createRequest(): Promise<
    CredentialProtocolOptions.CredentialProtocolMsgReturnType<DidCommRequestCredentialV1Message>
  > {
    throw new CredoError('Starting from a request is not supported for v1 issue credential protocol')
  }

  public async processRequest(
    messageContext: DidCommInboundMessageContext<DidCommRequestCredentialV1Message>
  ): Promise<DidCommCredentialExchangeRecord> {
    const { message: requestMessage, connection, agentContext } = messageContext

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // TODO: with this method, we should update the credential protocol to use the ConnectionApi, so it
    // only depends on the public api, rather than the internal API (this helps with breaking changes)
    const connectionService = agentContext.dependencyManager.resolve(DidCommConnectionService)

    agentContext.config.logger.debug(`Processing credential request with id ${requestMessage.id}`)

    const credentialExchangeRecord = await this.getByProperties(messageContext.agentContext, {
      threadId: requestMessage.threadId,
      role: DidCommCredentialRole.Issuer,
    })

    agentContext.config.logger.trace(
      'Credential record found when processing credential request',
      credentialExchangeRecord
    )

    const proposalMessage = await didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
      associatedRecordId: credentialExchangeRecord.id,
      messageClass: DidCommProposeCredentialV1Message,
      role: DidCommMessageRole.Receiver,
    })
    const offerMessage = await didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
      associatedRecordId: credentialExchangeRecord.id,
      messageClass: V1OfferCredentialMessage,
      role: DidCommMessageRole.Sender,
    })

    // Assert
    credentialExchangeRecord.assertProtocolVersion('v1')
    credentialExchangeRecord.assertState(DidCommCredentialState.OfferSent)
    await connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
      lastReceivedMessage: proposalMessage ?? undefined,
      lastSentMessage: offerMessage ?? undefined,
      expectedConnectionId: credentialExchangeRecord.connectionId,
    })

    // This makes sure that the sender of the incoming message is authorized to do so.
    if (!credentialExchangeRecord.connectionId) {
      await connectionService.matchIncomingMessageToRequestMessageInOutOfBandExchange(messageContext, {
        expectedConnectionId: credentialExchangeRecord.connectionId,
      })
      credentialExchangeRecord.connectionId = connection?.id
    }

    const requestAttachment = requestMessage.getRequestAttachmentById(INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID)

    if (!requestAttachment) {
      throw new CredoError(
        `Indy attachment with id ${INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID} not found in request message`
      )
    }

    await this.indyCredentialFormat.processRequest(messageContext.agentContext, {
      credentialExchangeRecord,
      attachment: requestAttachment,
    })

    await didCommMessageRepository.saveAgentMessage(messageContext.agentContext, {
      agentMessage: requestMessage,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialExchangeRecord.id,
    })

    await this.updateState(
      messageContext.agentContext,
      credentialExchangeRecord,
      DidCommCredentialState.RequestReceived
    )

    return credentialExchangeRecord
  }

  /**
   * Create a {@link DidCommIssueCredentialV1Message} as response to a received credential request.
   *
   * @returns Object containing issue credential message and associated credential record
   *
   */
  public async acceptRequest(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      credentialFormats,
      comment,
      autoAcceptCredential,
    }: CredentialProtocolOptions.AcceptCredentialRequestOptions<[LegacyIndyDidCommCredentialFormatService]>
  ): Promise<CredentialProtocolOptions.CredentialProtocolMsgReturnType<DidCommIssueCredentialV1Message>> {
    // Assert
    credentialExchangeRecord.assertProtocolVersion('v1')
    credentialExchangeRecord.assertState(DidCommCredentialState.RequestReceived)
    if (credentialFormats) this.assertOnlyIndyFormat(credentialFormats)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const offerMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeRecord.id,
      messageClass: V1OfferCredentialMessage,
      role: DidCommMessageRole.Sender,
    })
    const requestMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeRecord.id,
      messageClass: DidCommRequestCredentialV1Message,
      role: DidCommMessageRole.Receiver,
    })

    const offerAttachment = offerMessage.getOfferAttachmentById(INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)
    const requestAttachment = requestMessage.getRequestAttachmentById(INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID)

    if (!offerAttachment || !requestAttachment) {
      throw new CredoError(
        `Missing data payload in offer or request attachment in credential Record ${credentialExchangeRecord.id}`
      )
    }

    const { attachment } = await this.indyCredentialFormat.acceptRequest(agentContext, {
      credentialExchangeRecord,
      requestAttachment,
      offerAttachment,
      attachmentId: INDY_CREDENTIAL_ATTACHMENT_ID,
      credentialFormats,
    })

    const issueMessage = new DidCommIssueCredentialV1Message({
      comment,
      credentialAttachments: [attachment],
      attachments: credentialExchangeRecord.linkedAttachments,
    })

    issueMessage.setThread({
      threadId: credentialExchangeRecord.threadId,
      parentThreadId: credentialExchangeRecord.parentThreadId,
    })
    issueMessage.setPleaseAck()

    await didCommMessageRepository.saveAgentMessage(agentContext, {
      agentMessage: issueMessage,
      associatedRecordId: credentialExchangeRecord.id,
      role: DidCommMessageRole.Sender,
    })

    credentialExchangeRecord.autoAcceptCredential =
      autoAcceptCredential ?? credentialExchangeRecord.autoAcceptCredential
    await this.updateState(agentContext, credentialExchangeRecord, DidCommCredentialState.CredentialIssued)

    return { message: issueMessage, credentialExchangeRecord }
  }

  /**
   * Process an incoming {@link DidCommIssueCredentialV1Message}
   *
   * @param messageContext The message context containing a credential acknowledgement message
   * @returns credential record associated with the credential acknowledgement message
   *
   */
  public async processCredential(
    messageContext: DidCommInboundMessageContext<DidCommIssueCredentialV1Message>
  ): Promise<DidCommCredentialExchangeRecord> {
    const { message: issueMessage, connection, agentContext } = messageContext

    agentContext.config.logger.debug(`Processing credential with id ${issueMessage.id}`)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // TODO: with this method, we should update the credential protocol to use the ConnectionApi, so it
    // only depends on the public api, rather than the internal API (this helps with breaking changes)
    const connectionService = agentContext.dependencyManager.resolve(DidCommConnectionService)

    const credentialExchangeRecord = await this.getByProperties(messageContext.agentContext, {
      threadId: issueMessage.threadId,
      role: DidCommCredentialRole.Holder,
      connectionId: connection?.id,
    })

    const requestCredentialMessage = await didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
      associatedRecordId: credentialExchangeRecord.id,
      messageClass: DidCommRequestCredentialV1Message,
      role: DidCommMessageRole.Sender,
    })
    const offerCredentialMessage = await didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
      associatedRecordId: credentialExchangeRecord.id,
      messageClass: V1OfferCredentialMessage,
      role: DidCommMessageRole.Receiver,
    })

    // Assert
    credentialExchangeRecord.assertProtocolVersion('v1')
    credentialExchangeRecord.assertState(DidCommCredentialState.RequestSent)
    await connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
      lastReceivedMessage: offerCredentialMessage,
      lastSentMessage: requestCredentialMessage,
      expectedConnectionId: credentialExchangeRecord.connectionId,
    })

    const issueAttachment = issueMessage.getCredentialAttachmentById(INDY_CREDENTIAL_ATTACHMENT_ID)
    if (!issueAttachment) {
      throw new CredoError('Missing indy credential attachment in processCredential')
    }

    const requestAttachment = requestCredentialMessage?.getRequestAttachmentById(INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID)
    if (!requestAttachment) {
      throw new CredoError('Missing indy credential request attachment in processCredential')
    }

    const offerAttachment = offerCredentialMessage?.getOfferAttachmentById(INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)
    if (!offerAttachment) {
      throw new CredoError('Missing indy credential request attachment in processCredential')
    }

    await this.indyCredentialFormat.processCredential(messageContext.agentContext, {
      offerAttachment,
      attachment: issueAttachment,
      credentialExchangeRecord,
      requestAttachment,
    })

    await didCommMessageRepository.saveAgentMessage(messageContext.agentContext, {
      agentMessage: issueMessage,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialExchangeRecord.id,
    })

    await this.updateState(
      messageContext.agentContext,
      credentialExchangeRecord,
      DidCommCredentialState.CredentialReceived
    )

    return credentialExchangeRecord
  }

  /**
   * Create a {@link CredentialAckMessage} as response to a received credential.
   *
   * @param credentialExchangeRecord The credential record for which to create the credential acknowledgement
   * @returns Object containing credential acknowledgement message and associated credential record
   *
   */
  public async acceptCredential(
    agentContext: AgentContext,
    { credentialExchangeRecord }: CredentialProtocolOptions.AcceptCredentialOptions
  ): Promise<CredentialProtocolOptions.CredentialProtocolMsgReturnType<DidCommCredentialV1AckMessage>> {
    credentialExchangeRecord.assertProtocolVersion('v1')
    credentialExchangeRecord.assertState(DidCommCredentialState.CredentialReceived)

    // Create message
    const ackMessage = new DidCommCredentialV1AckMessage({
      status: AckStatus.OK,
      threadId: credentialExchangeRecord.threadId,
    })

    ackMessage.setThread({
      threadId: credentialExchangeRecord.threadId,
      parentThreadId: credentialExchangeRecord.parentThreadId,
    })

    await this.updateState(agentContext, credentialExchangeRecord, DidCommCredentialState.Done)

    return { message: ackMessage, credentialExchangeRecord }
  }

  /**
   * Process a received {@link CredentialAckMessage}.
   *
   * @param messageContext The message context containing a credential acknowledgement message
   * @returns credential record associated with the credential acknowledgement message
   *
   */
  public async processAck(
    messageContext: DidCommInboundMessageContext<DidCommCredentialV1AckMessage>
  ): Promise<DidCommCredentialExchangeRecord> {
    const { message: ackMessage, connection, agentContext } = messageContext

    agentContext.config.logger.debug(`Processing credential ack with id ${ackMessage.id}`)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // TODO: with this method, we should update the credential protocol to use the ConnectionApi, so it
    // only depends on the public api, rather than the internal API (this helps with breaking changes)
    const connectionService = agentContext.dependencyManager.resolve(DidCommConnectionService)

    const credentialExchangeRecord = await this.getByProperties(messageContext.agentContext, {
      threadId: ackMessage.threadId,

      role: DidCommCredentialRole.Issuer,
      connectionId: connection?.id,
    })

    const requestCredentialMessage = await didCommMessageRepository.getAgentMessage(messageContext.agentContext, {
      associatedRecordId: credentialExchangeRecord.id,
      messageClass: DidCommRequestCredentialV1Message,
      role: DidCommMessageRole.Receiver,
    })
    const issueCredentialMessage = await didCommMessageRepository.getAgentMessage(messageContext.agentContext, {
      associatedRecordId: credentialExchangeRecord.id,
      messageClass: DidCommIssueCredentialV1Message,
      role: DidCommMessageRole.Sender,
    })

    // Assert
    credentialExchangeRecord.assertProtocolVersion('v1')
    credentialExchangeRecord.assertState(DidCommCredentialState.CredentialIssued)
    await connectionService.assertConnectionOrOutOfBandExchange(messageContext, {
      lastReceivedMessage: requestCredentialMessage,
      lastSentMessage: issueCredentialMessage,
      expectedConnectionId: credentialExchangeRecord.connectionId,
    })

    // Update record
    await this.updateState(messageContext.agentContext, credentialExchangeRecord, DidCommCredentialState.Done)

    return credentialExchangeRecord
  }

  /**
   * Create a {@link DidCommCredentialV1ProblemReportMessage} to be sent.
   *
   * @param message message to send
   * @returns a {@link DidCommCredentialV1ProblemReportMessage}
   *
   */
  public async createProblemReport(
    _agentContext: AgentContext,
    { credentialExchangeRecord, description }: CredentialProtocolOptions.CreateCredentialProblemReportOptions
  ): Promise<CredentialProtocolOptions.CredentialProtocolMsgReturnType<DidCommProblemReportMessage>> {
    const message = new DidCommCredentialV1ProblemReportMessage({
      description: {
        en: description,
        code: DidCommCredentialProblemReportReason.IssuanceAbandoned,
      },
    })

    return { message, credentialExchangeRecord }
  }

  // AUTO RESPOND METHODS
  public async shouldAutoRespondToProposal(
    agentContext: AgentContext,
    options: {
      credentialExchangeRecord: DidCommCredentialExchangeRecord
      proposalMessage: DidCommProposeCredentialV1Message
    }
  ) {
    const { credentialExchangeRecord, proposalMessage } = options

    const credentialsModuleConfig = agentContext.dependencyManager.resolve(DidCommCredentialsModuleConfig)

    const autoAccept = composeCredentialAutoAccept(
      credentialExchangeRecord.autoAcceptCredential,
      credentialsModuleConfig.autoAcceptCredentials
    )

    // Handle always / never cases
    if (autoAccept === DidCommAutoAcceptCredential.Always) return true
    if (autoAccept === DidCommAutoAcceptCredential.Never) return false

    const offerMessage = await this.findOfferMessage(agentContext, credentialExchangeRecord.id)

    // Do not auto accept if missing properties
    if (!offerMessage || !offerMessage.credentialPreview) return false
    if (!proposalMessage.credentialPreview || !proposalMessage.credentialDefinitionId) return false

    const credentialOfferJson = offerMessage.indyCredentialOffer

    // Check if credential definition id matches
    if (!credentialOfferJson) return false
    if (credentialOfferJson.cred_def_id !== proposalMessage.credentialDefinitionId) return false

    // Check if preview values match
    return areCredentialPreviewAttributesEqual(
      proposalMessage.credentialPreview.attributes,
      offerMessage.credentialPreview.attributes
    )
  }

  public async shouldAutoRespondToOffer(
    agentContext: AgentContext,
    options: {
      credentialExchangeRecord: DidCommCredentialExchangeRecord
      offerMessage: V1OfferCredentialMessage
    }
  ) {
    const { credentialExchangeRecord, offerMessage } = options

    const credentialsModuleConfig = agentContext.dependencyManager.resolve(DidCommCredentialsModuleConfig)

    const autoAccept = composeCredentialAutoAccept(
      credentialExchangeRecord.autoAcceptCredential,
      credentialsModuleConfig.autoAcceptCredentials
    )

    // Handle always / never cases
    if (autoAccept === DidCommAutoAcceptCredential.Always) return true
    if (autoAccept === DidCommAutoAcceptCredential.Never) return false

    const proposalMessage = await this.findProposalMessage(agentContext, credentialExchangeRecord.id)

    // Do not auto accept if missing properties
    if (!offerMessage.credentialPreview) return false
    if (!proposalMessage || !proposalMessage.credentialPreview || !proposalMessage.credentialDefinitionId) return false

    const credentialOfferJson = offerMessage.indyCredentialOffer

    // Check if credential definition id matches
    if (!credentialOfferJson) return false
    if (credentialOfferJson.cred_def_id !== proposalMessage.credentialDefinitionId) return false

    // Check if preview values match
    return areCredentialPreviewAttributesEqual(
      proposalMessage.credentialPreview.attributes,
      offerMessage.credentialPreview.attributes
    )
  }

  public async shouldAutoRespondToRequest(
    agentContext: AgentContext,
    options: {
      credentialExchangeRecord: DidCommCredentialExchangeRecord
      requestMessage: DidCommRequestCredentialV1Message
    }
  ) {
    const { credentialExchangeRecord, requestMessage } = options

    const credentialsModuleConfig = agentContext.dependencyManager.resolve(DidCommCredentialsModuleConfig)

    const autoAccept = composeCredentialAutoAccept(
      credentialExchangeRecord.autoAcceptCredential,
      credentialsModuleConfig.autoAcceptCredentials
    )

    // Handle always / never cases
    if (autoAccept === DidCommAutoAcceptCredential.Always) return true
    if (autoAccept === DidCommAutoAcceptCredential.Never) return false

    const offerMessage = await this.findOfferMessage(agentContext, credentialExchangeRecord.id)
    if (!offerMessage) return false

    const offerAttachment = offerMessage.getOfferAttachmentById(INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)
    const requestAttachment = requestMessage.getRequestAttachmentById(INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID)

    if (!offerAttachment || !requestAttachment) return false

    return this.indyCredentialFormat.shouldAutoRespondToRequest(agentContext, {
      credentialExchangeRecord,
      offerAttachment,
      requestAttachment,
    })
  }

  public async shouldAutoRespondToCredential(
    agentContext: AgentContext,
    options: {
      credentialExchangeRecord: DidCommCredentialExchangeRecord
      credentialMessage: DidCommIssueCredentialV1Message
    }
  ) {
    const { credentialExchangeRecord, credentialMessage } = options

    const credentialsModuleConfig = agentContext.dependencyManager.resolve(DidCommCredentialsModuleConfig)

    const autoAccept = composeCredentialAutoAccept(
      credentialExchangeRecord.autoAcceptCredential,
      credentialsModuleConfig.autoAcceptCredentials
    )

    // Handle always / never cases
    if (autoAccept === DidCommAutoAcceptCredential.Always) return true
    if (autoAccept === DidCommAutoAcceptCredential.Never) return false

    const requestMessage = await this.findRequestMessage(agentContext, credentialExchangeRecord.id)
    const offerMessage = await this.findOfferMessage(agentContext, credentialExchangeRecord.id)

    const credentialAttachment = credentialMessage.getCredentialAttachmentById(INDY_CREDENTIAL_ATTACHMENT_ID)
    if (!credentialAttachment) return false

    const requestAttachment = requestMessage?.getRequestAttachmentById(INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID)
    if (!requestAttachment) return false

    const offerAttachment = offerMessage?.getOfferAttachmentById(INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)

    return this.indyCredentialFormat.shouldAutoRespondToCredential(agentContext, {
      credentialExchangeRecord,
      credentialAttachment,
      requestAttachment,
      offerAttachment,
    })
  }

  public async findProposalMessage(agentContext: AgentContext, credentialExchangeId: string) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    return await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeId,
      messageClass: DidCommProposeCredentialV1Message,
    })
  }

  public async findOfferMessage(agentContext: AgentContext, credentialExchangeId: string) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    return await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeId,
      messageClass: V1OfferCredentialMessage,
    })
  }

  public async findRequestMessage(agentContext: AgentContext, credentialExchangeId: string) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    return await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeId,
      messageClass: DidCommRequestCredentialV1Message,
    })
  }

  public async findCredentialMessage(agentContext: AgentContext, credentialExchangeId: string) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    return await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeId,
      messageClass: DidCommIssueCredentialV1Message,
    })
  }

  public async getFormatData(
    agentContext: AgentContext,
    credentialExchangeId: string
  ): Promise<
    CredentialProtocolOptions.GetCredentialFormatDataReturn<
      ExtractCredentialFormats<[LegacyIndyDidCommCredentialFormatService]>
    >
  > {
    // TODO: we could looking at fetching all record using a single query and then filtering based on the type of the message.
    const [proposalMessage, offerMessage, requestMessage, credentialMessage] = await Promise.all([
      this.findProposalMessage(agentContext, credentialExchangeId),
      this.findOfferMessage(agentContext, credentialExchangeId),
      this.findRequestMessage(agentContext, credentialExchangeId),
      this.findCredentialMessage(agentContext, credentialExchangeId),
    ])

    const indyProposal = proposalMessage
      ? JsonTransformer.toJSON(this.rfc0592ProposalFromV1ProposeMessage(proposalMessage))
      : undefined

    const indyOffer = offerMessage?.indyCredentialOffer ?? undefined
    const indyRequest = requestMessage?.indyCredentialRequest ?? undefined
    const indyCredential = credentialMessage?.indyCredential ?? undefined

    return {
      proposalAttributes: proposalMessage?.credentialPreview?.attributes,
      proposal: proposalMessage
        ? {
            indy: indyProposal,
          }
        : undefined,
      offerAttributes: offerMessage?.credentialPreview?.attributes,
      offer: offerMessage
        ? {
            indy: indyOffer,
          }
        : undefined,
      request: requestMessage
        ? {
            indy: indyRequest,
          }
        : undefined,
      credential: credentialMessage
        ? {
            indy: indyCredential,
          }
        : undefined,
    }
  }

  private rfc0592ProposalFromV1ProposeMessage(proposalMessage: DidCommProposeCredentialV1Message) {
    const indyCredentialProposal = new AnonCredsCredentialProposal({
      credentialDefinitionId: proposalMessage.credentialDefinitionId,
      schemaId: proposalMessage.schemaId,
      issuerDid: proposalMessage.issuerDid,
      schemaIssuerDid: proposalMessage.schemaIssuerDid,
      schemaName: proposalMessage.schemaName,
      schemaVersion: proposalMessage.schemaVersion,
    })

    return indyCredentialProposal
  }

  private assertOnlyIndyFormat(credentialFormats: Record<string, unknown>) {
    const formatKeys = Object.keys(credentialFormats)

    // It's fine to not have any formats in some cases, if indy is required the method that calls this should check for this
    if (formatKeys.length === 0) return

    if (formatKeys.length !== 1 || !formatKeys.includes('indy')) {
      throw new CredoError('Only indy credential format is supported for issue credential v1 protocol')
    }
  }

  public getFormatServiceForRecordType(credentialRecordType: string) {
    if (credentialRecordType !== this.indyCredentialFormat.credentialRecordType) {
      throw new CredoError(
        `Unsupported credential record type ${credentialRecordType} for v1 issue credential protocol (need ${this.indyCredentialFormat.credentialRecordType})`
      )
    }

    return this.indyCredentialFormat
  }
}
