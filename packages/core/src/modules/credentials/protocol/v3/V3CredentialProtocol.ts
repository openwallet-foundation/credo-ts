import type { AgentContext } from '../../../../agent'
import type { FeatureRegistry } from '../../../../agent/FeatureRegistry'
import type { MessageHandlerInboundMessage } from '../../../../agent/MessageHandler'
import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { V2Attachment } from '../../../../decorators/attachment'
import type { DidCommV2Message } from '../../../../didcomm'
import type { DependencyManager } from '../../../../plugins'
import type { V2ProblemReportMessage } from '../../../problem-reports'
import type {
  CredentialFormat,
  CredentialFormatPayload,
  CredentialFormatService,
  ExtractCredentialFormats,
} from '../../formats'
import type { CredentialProtocol } from '../CredentialProtocol'
import type {
  AcceptCredentialOptions,
  AcceptCredentialOfferOptions,
  AcceptCredentialProposalOptions,
  AcceptCredentialRequestOptions,
  CreateCredentialOfferOptions,
  CreateCredentialProposalOptions,
  CreateCredentialRequestOptions,
  CredentialProtocolMsgReturnType,
  CredentialFormatDataMessagePayload,
  CreateCredentialProblemReportOptions,
  GetCredentialFormatDataReturn,
  NegotiateCredentialOfferOptions,
  NegotiateCredentialProposalOptions,
} from '../CredentialProtocolOptions'

import { Protocol } from '../../../../agent/models/features/Protocol'
import { AriesFrameworkError } from '../../../../error'
import { DidCommMessageRepository } from '../../../../storage'
import { uuid } from '../../../../utils/uuid'
import { CredentialsModuleConfig } from '../../CredentialsModuleConfig'
import { AutoAcceptCredential, CredentialProblemReportReason, CredentialState } from '../../models'
import { CredentialExchangeRecord, CredentialRepository } from '../../repository'
import { composeAutoAccept } from '../../util/composeAutoAccept'
import { arePreviewAttributesEqual } from '../../util/previewAttributes'
import { BaseCredentialProtocol } from '../BaseCredentialProtocol'

import { CredentialFormatCoordinator } from './CredentialFormatCoordinator'
import {
  V3OfferCredentialHandler,
  V3CredentialAckHandler,
  V3IssueCredentialHandler,
  V3ProposeCredentialHandler,
  V3RequestCredentialHandler,
  V3CredentialProblemReportHandler,
} from './handlers'
import {
  V3CredentialAckMessage,
  V3CredentialProblemReportMessage,
  V3IssueCredentialMessage,
  V3OfferCredentialMessage,
  V3ProposeCredentialMessage,
  V3RequestCredentialMessage,
} from './messages'

export interface V3CredentialProtocolConfig<CredentialFormatServices extends CredentialFormatService[]> {
  credentialFormats: CredentialFormatServices
}

export class V3CredentialProtocol<CFs extends CredentialFormatService[] = CredentialFormatService[]>
  extends BaseCredentialProtocol<CFs>
  implements CredentialProtocol<CFs>
{
  private credentialFormatCoordinator = new CredentialFormatCoordinator<CFs>()
  private credentialFormats: CFs

  public constructor({ credentialFormats }: V3CredentialProtocolConfig<CFs>) {
    super()

    this.credentialFormats = credentialFormats
  }

  /**
   * The version of the issue credential protocol this service supports
   */
  public readonly version = 'v3' as const

  /**
   * Registers the protocol implementation (handlers, feature registry) on the agent.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Register message handlers for the Issue Credential V3 Protocol
    dependencyManager.registerMessageHandlers([
      new V3ProposeCredentialHandler(this),
      new V3OfferCredentialHandler(this),
      new V3RequestCredentialHandler(this),
      new V3IssueCredentialHandler(this),
      new V3CredentialAckHandler(this),
      new V3CredentialProblemReportHandler(this),
    ])

    // Register Issue Credential V3 in feature registry, with supported roles
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/issue-credential/3.0',
        roles: ['holder', 'issuer'],
      })
    )
  }

  /**
   * Create a {@link V3ProposeCredentialMessage} not bound to an existing credential exchange.
   *
   * @param proposal The ProposeCredentialOptions object containing the important fields for the credential message
   * @returns Object containing proposal message and associated credential record
   *
   */
  public async createProposal(
    agentContext: AgentContext,
    { connectionRecord, credentialFormats, comment, autoAcceptCredential }: CreateCredentialProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommV2Message>> {
    agentContext.config.logger.debug('Get the Format Service and Create Proposal Message')

    const credentialRepository = agentContext.dependencyManager.resolve(CredentialRepository)

    const formatServices = this.getFormatServices(credentialFormats)
    if (formatServices.length === 0) {
      throw new AriesFrameworkError(`Unable to create proposal. No supported formats`)
    }

    const credentialRecord = new CredentialExchangeRecord({
      connectionId: connectionRecord.id,
      threadId: uuid(),
      state: CredentialState.ProposalSent,
      autoAcceptCredential,
      protocolVersion: 'v3',
    })

    const proposalMessage = await this.credentialFormatCoordinator.createProposal(agentContext, {
      credentialFormats,
      credentialRecord,
      formatServices,
      comment,
    })

    agentContext.config.logger.debug('Save record and emit state change event')
    await credentialRepository.save(agentContext, credentialRecord)
    this.emitStateChangedEvent(agentContext, credentialRecord, null)

    return { credentialRecord, message: proposalMessage }
  }

  /**
   * Method called by {@link V3ProposeCredentialHandler} on reception of a propose credential message
   * We do the necessary processing here to accept the proposal and do the state change, emit event etc.
   * @param messageContext the inbound propose credential message
   * @returns credential record appropriate for this incoming message (once accepted)
   */
  public async processProposal(
    messageContext: InboundMessageContext<V3ProposeCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: proposalMessage, connection, agentContext } = messageContext

    agentContext.config.logger.debug(`Processing credential proposal with id ${proposalMessage.id}`)

    const credentialRepository = agentContext.dependencyManager.resolve(CredentialRepository)

    let credentialRecord = await this.findByThreadAndConnectionId(
      messageContext.agentContext,
      proposalMessage.threadId,
      connection?.id
    )

    const formatServices = this.getFormatServicesFromAttachments(proposalMessage.attachments)
    if (formatServices.length === 0) {
      throw new AriesFrameworkError(`Unable to process proposal. No supported formats`)
    }

    // credential record already exists
    if (credentialRecord) {
      // Assert
      credentialRecord.assertProtocolVersion('v3')
      credentialRecord.assertState(CredentialState.OfferSent)

      await this.credentialFormatCoordinator.processProposal(messageContext.agentContext, {
        credentialRecord,
        formatServices,
        message: proposalMessage,
      })

      await this.updateState(messageContext.agentContext, credentialRecord, CredentialState.ProposalReceived)

      return credentialRecord
    } else {
      // Assert

      // No credential record exists with thread id
      credentialRecord = new CredentialExchangeRecord({
        connectionId: connection?.id,
        threadId: proposalMessage.threadId,
        state: CredentialState.ProposalReceived,
        protocolVersion: 'v3',
      })

      await this.credentialFormatCoordinator.processProposal(messageContext.agentContext, {
        credentialRecord,
        formatServices,
        message: proposalMessage,
      })

      // Save record and emit event
      await credentialRepository.save(messageContext.agentContext, credentialRecord)
      this.emitStateChangedEvent(messageContext.agentContext, credentialRecord, null)

      return credentialRecord
    }
  }

  public async acceptProposal(
    agentContext: AgentContext,
    { credentialRecord, credentialFormats, autoAcceptCredential, comment }: AcceptCredentialProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<V3OfferCredentialMessage>> {
    // Assert
    credentialRecord.assertProtocolVersion('v3')
    credentialRecord.assertState(CredentialState.ProposalReceived)

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // Use empty credentialFormats if not provided to denote all formats should be accepted
    let formatServices = this.getFormatServices(credentialFormats ?? {})

    // if no format services could be extracted from the credentialFormats
    // take all available format services from the proposal message
    if (formatServices.length === 0) {
      const proposalMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
        associatedRecordId: credentialRecord.id,
        messageClass: V3ProposeCredentialMessage,
      })

      formatServices = this.getFormatServicesFromAttachments(proposalMessage.attachments)
    }

    // If the format services list is still empty, throw an error as we don't support any
    // of the formats
    if (formatServices.length === 0) {
      throw new AriesFrameworkError(
        `Unable to accept proposal. No supported formats provided as input or in proposal message`
      )
    }

    const offerMessage = await this.credentialFormatCoordinator.acceptProposal(agentContext, {
      credentialRecord,
      formatServices,
      comment,
      credentialFormats,
    })

    credentialRecord.autoAcceptCredential = autoAcceptCredential ?? credentialRecord.autoAcceptCredential
    await this.updateState(agentContext, credentialRecord, CredentialState.OfferSent)

    return { credentialRecord, message: offerMessage }
  }

  /**
   * Negotiate a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param options configuration for the offer see {@link NegotiateCredentialProposalOptions}
   * @returns Credential exchange record associated with the credential offer
   *
   */
  public async negotiateProposal(
    agentContext: AgentContext,
    { credentialRecord, credentialFormats, autoAcceptCredential, comment }: NegotiateCredentialProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<V3OfferCredentialMessage>> {
    // Assert
    credentialRecord.assertProtocolVersion('v3')
    credentialRecord.assertState(CredentialState.ProposalReceived)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support negotiation.`
      )
    }

    const formatServices = this.getFormatServices(credentialFormats)
    if (formatServices.length === 0) {
      throw new AriesFrameworkError(`Unable to create offer. No supported formats`)
    }

    const offerMessage = await this.credentialFormatCoordinator.createOffer(agentContext, {
      formatServices,
      credentialFormats,
      credentialRecord,
      comment,
    })

    credentialRecord.autoAcceptCredential = autoAcceptCredential ?? credentialRecord.autoAcceptCredential
    await this.updateState(agentContext, credentialRecord, CredentialState.OfferSent)

    return { credentialRecord, message: offerMessage }
  }

  /**
   * Create a {@link V3OfferCredentialMessage} as beginning of protocol process. If no connectionId is provided, the
   * exchange will be created without a connection for usage in oob and connection-less issuance.
   *
   * @param formatService {@link CredentialFormatService} the format service object containing format-specific logic
   * @param options attributes of the original offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOffer(
    agentContext: AgentContext,
    { credentialFormats, autoAcceptCredential, comment, connectionRecord }: CreateCredentialOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<V3OfferCredentialMessage>> {
    const credentialRepository = agentContext.dependencyManager.resolve(CredentialRepository)

    const formatServices = this.getFormatServices(credentialFormats)
    if (formatServices.length === 0) {
      throw new AriesFrameworkError(`Unable to create offer. No supported formats`)
    }

    const credentialRecord = new CredentialExchangeRecord({
      connectionId: connectionRecord?.id,
      threadId: uuid(),
      state: CredentialState.OfferSent,
      autoAcceptCredential,
      protocolVersion: 'v3',
    })

    const offerMessage = await this.credentialFormatCoordinator.createOffer(agentContext, {
      formatServices,
      credentialFormats,
      credentialRecord,
      comment,
    })

    agentContext.config.logger.debug(
      `Saving record and emitting state changed for credential exchange record ${credentialRecord.id}`
    )
    await credentialRepository.save(agentContext, credentialRecord)
    this.emitStateChangedEvent(agentContext, credentialRecord, null)

    return { credentialRecord, message: offerMessage }
  }

  /**
   * Method called by {@link V3OfferCredentialHandler} on reception of a offer credential message
   * We do the necessary processing here to accept the offer and do the state change, emit event etc.
   * @param messageContext the inbound offer credential message
   * @returns credential record appropriate for this incoming message (once accepted)
   */
  public async processOffer(
    messageContext: MessageHandlerInboundMessage<V3OfferCredentialHandler>
  ): Promise<CredentialExchangeRecord> {
    const { message: offerMessage, connection, agentContext } = messageContext

    agentContext.config.logger.debug(`Processing credential offer with id ${offerMessage.id}`)

    const credentialRepository = agentContext.dependencyManager.resolve(CredentialRepository)

    let credentialRecord = await this.findByThreadAndConnectionId(
      messageContext.agentContext,
      offerMessage.threadId,
      connection?.id
    )

    const formatServices = this.getFormatServicesFromAttachments(offerMessage.attachments)
    if (formatServices.length === 0) {
      throw new AriesFrameworkError(`Unable to process offer. No supported formats`)
    }

    // credential record already exists
    if (credentialRecord) {
      credentialRecord.assertProtocolVersion('v3')
      credentialRecord.assertState(CredentialState.ProposalSent)

      await this.credentialFormatCoordinator.processOffer(messageContext.agentContext, {
        credentialRecord,
        formatServices,
        message: offerMessage,
      })

      await this.updateState(messageContext.agentContext, credentialRecord, CredentialState.OfferReceived)
      return credentialRecord
    } else {
      // No credential record exists with thread id
      agentContext.config.logger.debug('No credential record found for offer, creating a new one')
      credentialRecord = new CredentialExchangeRecord({
        connectionId: connection?.id,
        threadId: offerMessage.threadId,
        state: CredentialState.OfferReceived,
        protocolVersion: 'v3',
      })

      await this.credentialFormatCoordinator.processOffer(messageContext.agentContext, {
        credentialRecord,
        formatServices,
        message: offerMessage,
      })

      // Save in repository
      agentContext.config.logger.debug('Saving credential record and emit offer-received event')
      await credentialRepository.save(messageContext.agentContext, credentialRecord)

      this.emitStateChangedEvent(messageContext.agentContext, credentialRecord, null)
      return credentialRecord
    }
  }

  public async acceptOffer(
    agentContext: AgentContext,
    { credentialRecord, autoAcceptCredential, comment, credentialFormats }: AcceptCredentialOfferOptions<CFs>
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // Assert
    credentialRecord.assertProtocolVersion('v3')
    credentialRecord.assertState(CredentialState.OfferReceived)

    // Use empty credentialFormats if not provided to denote all formats should be accepted
    let formatServices = this.getFormatServices(credentialFormats ?? {})

    // if no format services could be extracted from the credentialFormats
    // take all available format services from the offer message
    if (formatServices.length === 0) {
      const offerMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
        associatedRecordId: credentialRecord.id,
        messageClass: V3OfferCredentialMessage,
      })

      formatServices = this.getFormatServicesFromAttachments(offerMessage.attachments)
    }

    // If the format services list is still empty, throw an error as we don't support any
    // of the formats
    if (formatServices.length === 0) {
      throw new AriesFrameworkError(
        `Unable to accept offer. No supported formats provided as input or in offer message`
      )
    }

    const message = await this.credentialFormatCoordinator.acceptOffer(agentContext, {
      credentialRecord,
      formatServices,
      comment,
      credentialFormats,
    })

    credentialRecord.autoAcceptCredential = autoAcceptCredential ?? credentialRecord.autoAcceptCredential
    await this.updateState(agentContext, credentialRecord, CredentialState.RequestSent)

    return { credentialRecord, message }
  }

  /**
   * Create a {@link ProposePresentationMessage} as response to a received credential offer.
   * To create a proposal not bound to an existing credential exchange, use {@link createProposal}.
   *
   * @param options configuration to use for the proposal
   * @returns Object containing proposal message and associated credential record
   *
   */
  public async negotiateOffer(
    agentContext: AgentContext,
    { credentialRecord, credentialFormats, autoAcceptCredential, comment }: NegotiateCredentialOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<V3ProposeCredentialMessage>> {
    // Assert
    credentialRecord.assertProtocolVersion('v3')
    credentialRecord.assertState(CredentialState.OfferReceived)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support negotiation.`
      )
    }

    const formatServices = this.getFormatServices(credentialFormats)
    if (formatServices.length === 0) {
      throw new AriesFrameworkError(`Unable to create proposal. No supported formats`)
    }

    const proposalMessage = await this.credentialFormatCoordinator.createProposal(agentContext, {
      formatServices,
      credentialFormats,
      credentialRecord,
      comment,
    })

    credentialRecord.autoAcceptCredential = autoAcceptCredential ?? credentialRecord.autoAcceptCredential
    await this.updateState(agentContext, credentialRecord, CredentialState.ProposalSent)

    return { credentialRecord, message: proposalMessage }
  }

  /**
   * Create a {@link V3RequestCredentialMessage} as beginning of protocol process.
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createRequest(
    agentContext: AgentContext,
    { credentialFormats, autoAcceptCredential, comment, connectionRecord }: CreateCredentialRequestOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<V3RequestCredentialMessage>> {
    const credentialRepository = agentContext.dependencyManager.resolve(CredentialRepository)

    const formatServices = this.getFormatServices(credentialFormats)
    if (formatServices.length === 0) {
      throw new AriesFrameworkError(`Unable to create request. No supported formats`)
    }

    const credentialRecord = new CredentialExchangeRecord({
      connectionId: connectionRecord.id,
      threadId: uuid(),
      state: CredentialState.RequestSent,
      autoAcceptCredential,
      protocolVersion: 'v3',
    })

    const requestMessage = await this.credentialFormatCoordinator.createRequest(agentContext, {
      formatServices,
      credentialFormats,
      credentialRecord,
      comment,
    })

    agentContext.config.logger.debug(
      `Saving record and emitting state changed for credential exchange record ${credentialRecord.id}`
    )
    await credentialRepository.save(agentContext, credentialRecord)
    this.emitStateChangedEvent(agentContext, credentialRecord, null)

    return { credentialRecord, message: requestMessage }
  }

  /**
   * Process a received {@link RequestCredentialMessage}. This will not accept the credential request
   * or send a credential. It will only update the existing credential record with
   * the information from the credential request message. Use {@link createCredential}
   * after calling this method to create a credential.
   *z
   * @param messageContext The message context containing a v3 credential request message
   * @returns credential record associated with the credential request message
   *
   */
  public async processRequest(
    messageContext: InboundMessageContext<V3RequestCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: requestMessage, connection, agentContext } = messageContext

    const credentialRepository = agentContext.dependencyManager.resolve(CredentialRepository)

    agentContext.config.logger.debug(`Processing credential request with id ${requestMessage.id}`)

    let credentialRecord = await this.findByThreadAndConnectionId(
      messageContext.agentContext,
      requestMessage.threadId,
      connection?.id
    )

    const formatServices = this.getFormatServicesFromAttachments(requestMessage.attachments)
    if (formatServices.length === 0) {
      throw new AriesFrameworkError(`Unable to process request. No supported formats`)
    }

    // credential record already exists
    if (credentialRecord) {
      // Assert
      credentialRecord.assertProtocolVersion('v3')
      credentialRecord.assertState(CredentialState.OfferSent)

      await this.credentialFormatCoordinator.processRequest(messageContext.agentContext, {
        credentialRecord,
        formatServices,
        message: requestMessage,
      })

      await this.updateState(messageContext.agentContext, credentialRecord, CredentialState.RequestReceived)
      return credentialRecord
    } else {
      // No credential record exists with thread id
      agentContext.config.logger.debug('No credential record found for request, creating a new one')
      credentialRecord = new CredentialExchangeRecord({
        connectionId: connection?.id,
        threadId: requestMessage.threadId,
        state: CredentialState.RequestReceived,
        protocolVersion: 'v3',
      })

      await this.credentialFormatCoordinator.processRequest(messageContext.agentContext, {
        credentialRecord,
        formatServices,
        message: requestMessage,
      })

      // Save in repository
      agentContext.config.logger.debug('Saving credential record and emit request-received event')
      await credentialRepository.save(messageContext.agentContext, credentialRecord)

      this.emitStateChangedEvent(messageContext.agentContext, credentialRecord, null)
      return credentialRecord
    }
  }

  public async acceptRequest(
    agentContext: AgentContext,
    { credentialRecord, autoAcceptCredential, comment, credentialFormats }: AcceptCredentialRequestOptions<CFs>
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // Assert
    credentialRecord.assertProtocolVersion('v3')
    credentialRecord.assertState(CredentialState.RequestReceived)

    // Use empty credentialFormats if not provided to denote all formats should be accepted
    let formatServices = this.getFormatServices(credentialFormats ?? {})

    // if no format services could be extracted from the credentialFormats
    // take all available format services from the request message
    if (formatServices.length === 0) {
      const requestMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
        associatedRecordId: credentialRecord.id,
        messageClass: V3RequestCredentialMessage,
      })

      formatServices = this.getFormatServicesFromAttachments(requestMessage.attachments)
    }

    // If the format services list is still empty, throw an error as we don't support any
    // of the formats
    if (formatServices.length === 0) {
      throw new AriesFrameworkError(
        `Unable to accept request. No supported formats provided as input or in request message`
      )
    }
    const message = await this.credentialFormatCoordinator.acceptRequest(agentContext, {
      credentialRecord,
      formatServices,
      comment,
      credentialFormats,
    })

    credentialRecord.autoAcceptCredential = autoAcceptCredential ?? credentialRecord.autoAcceptCredential
    await this.updateState(agentContext, credentialRecord, CredentialState.CredentialIssued)

    return { credentialRecord, message }
  }

  /**
   * Process a received {@link V3IssueCredentialMessage}. This will not accept the credential
   * or send a credential acknowledgement. It will only update the existing credential record with
   * the information from the issue credential message. Use {@link createAck}
   * after calling this method to create a credential acknowledgement.
   *
   * @param messageContext The message context containing an issue credential message
   *
   * @returns credential record associated with the issue credential message
   *
   */
  public async processCredential(
    messageContext: InboundMessageContext<V3IssueCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: credentialMessage, connection, agentContext } = messageContext

    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    agentContext.config.logger.debug(`Processing credential with id ${credentialMessage.id}`)

    const credentialRecord = await this.getByThreadAndConnectionId(
      messageContext.agentContext,
      credentialMessage.threadId,
      connection?.id
    )

    const requestMessage = await didCommMessageRepository.getAgentMessage(messageContext.agentContext, {
      associatedRecordId: credentialRecord.id,
      messageClass: V3RequestCredentialMessage,
    })

    // Assert
    credentialRecord.assertProtocolVersion('v3')
    credentialRecord.assertState(CredentialState.RequestSent)

    const formatServices = this.getFormatServicesFromAttachments(credentialMessage.attachments)
    if (formatServices.length === 0) {
      throw new AriesFrameworkError(`Unable to process credential. No supported formats`)
    }

    await this.credentialFormatCoordinator.processCredential(messageContext.agentContext, {
      credentialRecord,
      formatServices,
      requestMessage: requestMessage,
      message: credentialMessage,
    })

    await this.updateState(messageContext.agentContext, credentialRecord, CredentialState.CredentialReceived)

    return credentialRecord
  }

  /**
   * Create a {@link V3CredentialAckMessage} as response to a received credential.
   *
   * @param credentialRecord The credential record for which to create the credential acknowledgement
   * @returns Object containing credential acknowledgement message and associated credential record
   *
   */
  public async acceptCredential(
    agentContext: AgentContext,
    { credentialRecord }: AcceptCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<V3CredentialAckMessage>> {
    credentialRecord.assertProtocolVersion('v3')
    credentialRecord.assertState(CredentialState.CredentialReceived)

    // Create message
    const ackMessage = new V3CredentialAckMessage({
      threadId: credentialRecord.threadId,
    })

    await this.updateState(agentContext, credentialRecord, CredentialState.Done)

    return { message: ackMessage, credentialRecord }
  }

  /**
   * Process a received {@link CredentialAckMessage}.
   *
   * @param messageContext The message context containing a credential acknowledgement message
   * @returns credential record associated with the credential acknowledgement message
   *
   */
  public async processAck(
    messageContext: InboundMessageContext<V3CredentialAckMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: ackMessage, connection, agentContext } = messageContext

    agentContext.config.logger.debug(`Processing credential ack with id ${ackMessage.id}`)

    const credentialRecord = await this.getByThreadAndConnectionId(
      messageContext.agentContext,
      ackMessage.threadId,
      connection?.id
    )
    credentialRecord.connectionId = connection?.id

    // Assert
    credentialRecord.assertProtocolVersion('v3')
    credentialRecord.assertState(CredentialState.CredentialIssued)

    // Update record
    await this.updateState(messageContext.agentContext, credentialRecord, CredentialState.Done)

    return credentialRecord
  }

  /**
   * Create a {@link V3CredentialProblemReportMessage} to be sent.
   *
   * @param message message to send
   * @returns a {@link V3CredentialProblemReportMessage}
   *
   */
  public async createProblemReport(
    agentContext: AgentContext,
    { credentialRecord, description }: CreateCredentialProblemReportOptions
  ): Promise<CredentialProtocolMsgReturnType<V2ProblemReportMessage>> {
    const message = new V3CredentialProblemReportMessage({
      parentThreadId: credentialRecord.threadId,
      body: {
        comment: description,
        code: CredentialProblemReportReason.IssuanceAbandoned,
      },
    })

    return { credentialRecord, message }
  }

  // AUTO ACCEPT METHODS
  public async shouldAutoRespondToProposal(
    agentContext: AgentContext,
    options: {
      credentialRecord: CredentialExchangeRecord
      proposalMessage: V3ProposeCredentialMessage
    }
  ): Promise<boolean> {
    const { credentialRecord, proposalMessage } = options
    const credentialsModuleConfig = agentContext.dependencyManager.resolve(CredentialsModuleConfig)

    const autoAccept = composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      credentialsModuleConfig.autoAcceptCredentials
    )

    // Handle always / never cases
    if (autoAccept === AutoAcceptCredential.Always) return true
    if (autoAccept === AutoAcceptCredential.Never) return false

    const offerMessage = await this.findOfferMessage(agentContext, credentialRecord.id)
    if (!offerMessage) return false

    // NOTE: we take the formats from the offerMessage so we always check all services that we last sent
    // Otherwise we'll only check the formats from the proposal, which could be different from the formats
    // we use.
    const formatServices = this.getFormatServicesFromAttachments(offerMessage.attachments)

    for (const formatService of formatServices) {
      const offerAttachment = this.credentialFormatCoordinator.getAttachmentForService(
        formatService,
        offerMessage.attachments
      )

      const proposalAttachment = this.credentialFormatCoordinator.getAttachmentForService(
        formatService,
        proposalMessage.attachments
      )

      const shouldAutoRespondToFormat = await formatService.shouldAutoRespondToProposal(agentContext, {
        credentialRecord,
        offerAttachment,
        proposalAttachment,
      })
      // If any of the formats return false, we should not auto accept
      if (!shouldAutoRespondToFormat) return false
    }

    // not all formats use the proposal and preview, we only check if they're present on
    // either or both of the messages
    if (proposalMessage.body.credentialPreview || offerMessage.body.credentialPreview) {
      // if one of the message doesn't have a preview, we should not auto accept
      if (!proposalMessage.body.credentialPreview || !offerMessage.body.credentialPreview) return false

      // Check if preview values match
      return arePreviewAttributesEqual(
        proposalMessage.body.credentialPreview.attributes,
        offerMessage.body.credentialPreview.attributes
      )
    }

    return true
  }

  public async shouldAutoRespondToOffer(
    agentContext: AgentContext,
    options: {
      credentialRecord: CredentialExchangeRecord
      offerMessage: V3OfferCredentialMessage
    }
  ): Promise<boolean> {
    const { credentialRecord, offerMessage } = options
    const credentialsModuleConfig = agentContext.dependencyManager.resolve(CredentialsModuleConfig)

    const autoAccept = composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      credentialsModuleConfig.autoAcceptCredentials
    )
    // Handle always / never cases
    if (autoAccept === AutoAcceptCredential.Always) return true
    if (autoAccept === AutoAcceptCredential.Never) return false

    const proposalMessage = await this.findProposalMessage(agentContext, credentialRecord.id)
    if (!proposalMessage) return false

    // NOTE: we take the formats from the proposalMessage so we always check all services that we last sent
    // Otherwise we'll only check the formats from the offer, which could be different from the formats
    // we use.
    const formatServices = this.getFormatServicesFromAttachments(proposalMessage.attachments)

    for (const formatService of formatServices) {
      const offerAttachment = this.credentialFormatCoordinator.getAttachmentForService(
        formatService,
        offerMessage.attachments
      )

      const proposalAttachment = this.credentialFormatCoordinator.getAttachmentForService(
        formatService,
        proposalMessage.attachments
      )

      const shouldAutoRespondToFormat = await formatService.shouldAutoRespondToOffer(agentContext, {
        credentialRecord,
        offerAttachment,
        proposalAttachment,
      })

      // If any of the formats return false, we should not auto accept

      if (!shouldAutoRespondToFormat) return false
    }

    // if one of the message doesn't have a preview, we should not auto accept
    if (proposalMessage.body.credentialPreview || offerMessage.body.credentialPreview) {
      // Check if preview values match
      return arePreviewAttributesEqual(
        proposalMessage.body.credentialPreview?.attributes ?? [],
        offerMessage.body.credentialPreview?.attributes ?? []
      )
    }
    return true
  }

  public async shouldAutoRespondToRequest(
    agentContext: AgentContext,
    options: {
      credentialRecord: CredentialExchangeRecord
      requestMessage: V3RequestCredentialMessage
    }
  ): Promise<boolean> {
    const { credentialRecord, requestMessage } = options
    const credentialsModuleConfig = agentContext.dependencyManager.resolve(CredentialsModuleConfig)

    const autoAccept = composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      credentialsModuleConfig.autoAcceptCredentials
    )

    // Handle always / never cases
    if (autoAccept === AutoAcceptCredential.Always) return true
    if (autoAccept === AutoAcceptCredential.Never) return false

    const proposalMessage = await this.findProposalMessage(agentContext, credentialRecord.id)

    const offerMessage = await this.findOfferMessage(agentContext, credentialRecord.id)
    if (!offerMessage) return false

    // NOTE: we take the formats from the offerMessage so we always check all services that we last sent
    // Otherwise we'll only check the formats from the request, which could be different from the formats
    // we use.
    const formatServices = this.getFormatServicesFromAttachments(offerMessage.attachments)

    for (const formatService of formatServices) {
      const offerAttachment = this.credentialFormatCoordinator.getAttachmentForService(
        formatService,
        offerMessage.attachments
      )

      const proposalAttachment = proposalMessage
        ? this.credentialFormatCoordinator.getAttachmentForService(formatService, proposalMessage.attachments)
        : undefined

      const requestAttachment = this.credentialFormatCoordinator.getAttachmentForService(
        formatService,
        requestMessage.attachments
      )

      const shouldAutoRespondToFormat = await formatService.shouldAutoRespondToRequest(agentContext, {
        credentialRecord,
        offerAttachment,
        requestAttachment,
        proposalAttachment,
      })

      // If any of the formats return false, we should not auto accept
      if (!shouldAutoRespondToFormat) return false
    }

    return true
  }

  public async shouldAutoRespondToCredential(
    agentContext: AgentContext,
    options: {
      credentialRecord: CredentialExchangeRecord
      credentialMessage: V3IssueCredentialMessage
    }
  ): Promise<boolean> {
    const { credentialRecord, credentialMessage } = options
    const credentialsModuleConfig = agentContext.dependencyManager.resolve(CredentialsModuleConfig)

    const autoAccept = composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      credentialsModuleConfig.autoAcceptCredentials
    )

    // Handle always / never cases
    if (autoAccept === AutoAcceptCredential.Always) return true
    if (autoAccept === AutoAcceptCredential.Never) return false

    const proposalMessage = await this.findProposalMessage(agentContext, credentialRecord.id)
    const offerMessage = await this.findOfferMessage(agentContext, credentialRecord.id)

    const requestMessage = await this.findRequestMessage(agentContext, credentialRecord.id)
    if (!requestMessage) return false

    // NOTE: we take the formats from the requestMessage so we always check all services that we last sent
    // Otherwise we'll only check the formats from the credential, which could be different from the formats
    // we use.
    const formatServices = this.getFormatServicesFromAttachments(requestMessage.attachments)

    for (const formatService of formatServices) {
      const offerAttachment = offerMessage
        ? this.credentialFormatCoordinator.getAttachmentForService(formatService, offerMessage.attachments)
        : undefined

      const proposalAttachment = proposalMessage
        ? this.credentialFormatCoordinator.getAttachmentForService(formatService, proposalMessage.attachments)
        : undefined

      const requestAttachment = this.credentialFormatCoordinator.getAttachmentForService(
        formatService,
        requestMessage.attachments
      )

      const credentialAttachment = this.credentialFormatCoordinator.getAttachmentForService(
        formatService,
        credentialMessage.attachments
      )

      const shouldAutoRespondToFormat = await formatService.shouldAutoRespondToCredential(agentContext, {
        credentialRecord,
        offerAttachment,
        credentialAttachment,
        requestAttachment,
        proposalAttachment,
      })

      // If any of the formats return false, we should not auto accept
      if (!shouldAutoRespondToFormat) return false
    }
    return true
  }

  public async findProposalMessage(agentContext: AgentContext, credentialExchangeId: string) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    return didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeId,
      messageClass: V3ProposeCredentialMessage,
    })
  }

  public async findOfferMessage(agentContext: AgentContext, credentialExchangeId: string) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    return await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeId,
      messageClass: V3OfferCredentialMessage,
    })
  }

  public async findRequestMessage(agentContext: AgentContext, credentialExchangeId: string) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    return await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeId,
      messageClass: V3RequestCredentialMessage,
    })
  }

  public async findCredentialMessage(agentContext: AgentContext, credentialExchangeId: string) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    return await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeId,
      messageClass: V3IssueCredentialMessage,
    })
  }

  public async getFormatData(
    agentContext: AgentContext,
    credentialExchangeId: string
  ): Promise<GetCredentialFormatDataReturn<ExtractCredentialFormats<CFs>>> {
    // TODO: we could looking at fetching all record using a single query and then filtering based on the type of the message.
    const [proposalMessage, offerMessage, requestMessage, credentialMessage] = await Promise.all([
      this.findProposalMessage(agentContext, credentialExchangeId),
      this.findOfferMessage(agentContext, credentialExchangeId),
      this.findRequestMessage(agentContext, credentialExchangeId),
      this.findCredentialMessage(agentContext, credentialExchangeId),
    ])

    // Create object with the keys and the message formats/attachments. We can then loop over this in a generic
    // way so we don't have to add the same operation code four times
    const messages = {
      proposal: proposalMessage?.attachments,
      offer: offerMessage?.attachments,
      request: requestMessage?.attachments,
      credential: credentialMessage?.attachments,
    } as const

    const formatData: GetCredentialFormatDataReturn = {
      proposalAttributes: proposalMessage?.body.credentialPreview?.attributes,
      offerAttributes: offerMessage?.body.credentialPreview?.attributes,
    }

    // We loop through all of the message keys as defined above
    for (const [messageKey, attachments] of Object.entries(messages)) {
      // Message can be undefined, so we continue if it is not defined
      if (!attachments) continue

      // Find all format services associated with the message
      const formatServices = this.getFormatServicesFromAttachments(attachments)
      const messageFormatData: CredentialFormatDataMessagePayload = {}

      // Loop through all of the format services, for each we will extract the attachment data and assign this to the object
      // using the unique format key (e.g. indy)
      for (const formatService of formatServices) {
        const attachment = this.credentialFormatCoordinator.getAttachmentForService(formatService, attachments)

        messageFormatData[formatService.formatKey] = attachment.getDataAsJson()
      }

      formatData[messageKey as Exclude<keyof GetCredentialFormatDataReturn, 'proposalAttributes' | 'offerAttributes'>] =
        messageFormatData
    }

    return formatData
  }

  /**
   * Get all the format service objects for a given credential format from an incoming message
   * @param attachments the attachment objects containing the format name (eg indy)
   * @return the credential format service objects in an array - derived from format object keys
   */
  private getFormatServicesFromAttachments(attachments: V2Attachment[]): CredentialFormatService[] {
    const formatServices = new Set<CredentialFormatService>()

    for (const attachment of attachments) {
      const service = attachment.format ? this.getFormatServiceForFormat(attachment.format) : undefined
      if (service) formatServices.add(service)
    }

    return Array.from(formatServices)
  }

  /**
   * Get all the format service objects for a given credential format
   * @param credentialFormats the format object containing various optional parameters
   * @return the credential format service objects in an array - derived from format object keys
   */
  private getFormatServices<M extends keyof CredentialFormat['credentialFormats']>(
    credentialFormats: CredentialFormatPayload<ExtractCredentialFormats<CFs>, M>
  ): CredentialFormatService[] {
    const formats = new Set<CredentialFormatService>()

    for (const formatKey of Object.keys(credentialFormats)) {
      const formatService = this.getFormatServiceForFormatKey(formatKey)

      if (formatService) formats.add(formatService)
    }

    return Array.from(formats)
  }

  private getFormatServiceForFormatKey(formatKey: string): CredentialFormatService | null {
    const formatService = this.credentialFormats.find((credentialFormat) => credentialFormat.formatKey === formatKey)

    return formatService ?? null
  }

  private getFormatServiceForFormat(format: string): CredentialFormatService | null {
    const formatService = this.credentialFormats.find((credentialFormat) => credentialFormat.supportsFormat(format))

    return formatService ?? null
  }

  protected getFormatServiceForRecordType(credentialRecordType: string) {
    const formatService = this.credentialFormats.find(
      (credentialFormat) => credentialFormat.credentialRecordType === credentialRecordType
    )

    if (!formatService) {
      throw new AriesFrameworkError(
        `No format service found for credential record type ${credentialRecordType} in v3 credential protocol`
      )
    }

    return formatService
  }
}
