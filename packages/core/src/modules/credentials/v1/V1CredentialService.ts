/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  CredentialOfferTemplate,
  CredentialProposeOptions,
  CredentialProtocolMsgReturnType,
  V1LegacyCredentialService,
} from '.'
import type { EventEmitter } from '../../../../src/agent/EventEmitter'
import type { HandlerInboundMessage } from '../../../../src/agent/Handler'
import type { InboundMessageContext } from '../../../../src/agent/models/InboundMessageContext'
import type { DidCommMessageRepository } from '../../../../src/storage'
import type { AgentConfig } from '../../../agent/AgentConfig'
import type { AgentMessage } from '../../../agent/AgentMessage'
import type { Dispatcher } from '../../../agent/Dispatcher'
import type { ConnectionService } from '../../connections/services/ConnectionService'
import type { MediationRecipientService, MediatorService } from '../../routing'
import type { CredentialStateChangedEvent } from '../CredentialEvents'
import type { CredentialResponseCoordinator } from '../CredentialResponseCoordinator'
import type { CredentialState } from '../CredentialState'
import type {
  AcceptProposalOptions,
  AcceptRequestOptions,
  CredPropose,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../interfaces'
import type { CredentialExchangeRecord, CredentialRepository } from '../repository'
import type { V2CredProposeOfferRequestFormat, CredentialFormatService } from '../v2/formats/CredentialFormatService'
import type { V2CredentialAckMessage } from '../v2/messages/V2CredentialAckMessage'
import type { V2IssueCredentialMessage } from '../v2/messages/V2IssueCredentialMessage'
import type { V2RequestCredentialMessage } from '../v2/messages/V2RequestCredentialMessage'
import type {
  CredentialAckMessage,
  IssueCredentialMessage,
  OfferCredentialMessage,
  RequestCredentialMessage,
} from './messages'

import { ServiceDecorator } from '../../../../src/decorators/service/ServiceDecorator'
import { DidCommMessageRole } from '../../../../src/storage'
import { AriesFrameworkError } from '../../../error'
import { ConsoleLogger, LogLevel } from '../../../logger'
import { isLinkedAttachment } from '../../../utils/attachment'
import { CredentialEventTypes } from '../CredentialEvents'
import { CredentialProtocolVersion } from '../CredentialProtocolVersion'
import { CredentialService } from '../CredentialService'

import { V1CredentialPreview } from './V1CredentialPreview'
import {
  CredentialAckHandler,
  CredentialProblemReportHandler,
  IssueCredentialHandler,
  OfferCredentialHandler,
  ProposeCredentialHandler,
  RequestCredentialHandler,
} from './handlers'
import { ProposeCredentialMessage } from './messages'

const logger = new ConsoleLogger(LogLevel.debug)

export class V1CredentialService extends CredentialService {
  public update(credentialRecord: CredentialExchangeRecord): Promise<void> {
    return this.legacyCredentialService.update(credentialRecord)
  }
  public updateState(credentialRecord: CredentialExchangeRecord, newState: CredentialState): Promise<void> {
    throw new Error('Method not implemented.')
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public processCredential(
    messageContext: InboundMessageContext<V2IssueCredentialMessage | IssueCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    throw new Error('Method not implemented.')
  }
  public async createAck(
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialProtocolMsgReturnType<CredentialAckMessage | V2CredentialAckMessage>> {
    return await this.legacyCredentialService.createAck(credentialRecord)
  }
  public createCredential(
    credentialRecord: CredentialExchangeRecord,
    options?: AcceptRequestOptions
  ): Promise<CredentialProtocolMsgReturnType<IssueCredentialMessage | V2IssueCredentialMessage>> {
    return this.legacyCredentialService.createCredential(credentialRecord, options)
  }

  public processRequest(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    messageContext: InboundMessageContext<RequestCredentialMessage | V2RequestCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    throw new Error('Method not implemented.')
  }
  private legacyCredentialService: V1LegacyCredentialService // MJR-TODO move all functionality from that class into here
  private connectionService: ConnectionService
  private didCommMessageRepository: DidCommMessageRepository
  private agentConfig: AgentConfig
  private credentialResponseCoordinator: CredentialResponseCoordinator
  private mediationRecipientService: MediationRecipientService
  private dispatcher: Dispatcher
  private eventEmitter: EventEmitter
  private credentialRepository: CredentialRepository

  public constructor(
    connectionService: ConnectionService,
    credentialService: V1LegacyCredentialService,
    didCommMessageRepository: DidCommMessageRepository,
    agentConfig: AgentConfig,
    credentialResponseCoordinator: CredentialResponseCoordinator,
    mediationRecipientService: MediationRecipientService,
    dispatcher: Dispatcher,
    eventEmitter: EventEmitter,
    credentialRepository: CredentialRepository
  ) {
    super()
    this.legacyCredentialService = credentialService
    this.connectionService = connectionService
    this.didCommMessageRepository = didCommMessageRepository
    this.agentConfig = agentConfig
    this.credentialResponseCoordinator = credentialResponseCoordinator
    this.mediationRecipientService = mediationRecipientService
    this.dispatcher = dispatcher
    this.eventEmitter = eventEmitter
    this.credentialRepository = credentialRepository
  }

  /**
   * Process a received {@link ProposeCredentialMessage}. This will not accept the credential proposal
   * or send a credential offer. It will only create a new, or update the existing credential record with
   * the information from the credential proposal message. Use {@link V1LegacyCredentialService#createOfferAsResponse}
   * after calling this method to create a credential offer.
   *
   * @param messageContext The message context containing a credential proposal message
   * @returns credential record associated with the credential proposal message
   *
   */
  public processProposal(
    messageContext: HandlerInboundMessage<ProposeCredentialHandler>
  ): Promise<CredentialExchangeRecord> {
    return this.legacyCredentialService.processProposal(messageContext)
  }

  /**
   * Process a received {@link OfferCredentialMessage}. This will not accept the credential offer
   * or send a credential request. It will only create a new credential record with
   * the information from the credential offer message. Use {@link V1LegacyCredentialService#createRequest}
   * after calling this method to create a credential request.
   *
   * @param messageContext The message context containing a credential request message
   * @returns credential record associated with the credential offer message
   *
   */
  public processOffer(
    messageContext: HandlerInboundMessage<OfferCredentialHandler>
  ): Promise<CredentialExchangeRecord> {
    return this.legacyCredentialService.processOffer(messageContext)
  }

  /**
   * Create a {@link OfferCredentialMessage} as response to a received credential proposal.
   * To create an offer not bound to an existing credential exchange, use {@link V1LegacyCredentialService#createOffer}.
   *
   * @param credentialRecord The credential record for which to create the credential offer
   * @param credentialTemplate The credential template to use for the offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOfferAsResponse(
    credentialRecord: CredentialExchangeRecord,
    credentialTemplate: CredentialOfferTemplate
  ): Promise<CredentialProtocolMsgReturnType<OfferCredentialMessage>> {
    return this.legacyCredentialService.createOfferAsResponse(credentialRecord, credentialTemplate)
  }

  public registerHandlers() {
    this.dispatcher.registerHandler(
      new ProposeCredentialHandler(
        this.legacyCredentialService,
        this.agentConfig,
        this.credentialResponseCoordinator,
        this.didCommMessageRepository
      )
    )
    this.dispatcher.registerHandler(
      new OfferCredentialHandler(
        this.legacyCredentialService,
        this.agentConfig,
        this.credentialResponseCoordinator,
        this.mediationRecipientService,
        this.didCommMessageRepository
      )
    )
    this.dispatcher.registerHandler(
      new RequestCredentialHandler(
        this.legacyCredentialService,
        this.agentConfig,
        this.credentialResponseCoordinator,
        this.didCommMessageRepository
      )
    )
    this.dispatcher.registerHandler(
      new IssueCredentialHandler(
        this.legacyCredentialService,
        this.agentConfig,
        this.credentialResponseCoordinator,
        this.didCommMessageRepository
      )
    )
    this.dispatcher.registerHandler(new CredentialAckHandler(this.legacyCredentialService))
    this.dispatcher.registerHandler(new CredentialProblemReportHandler(this.legacyCredentialService))
  }

  /**
   *
   * Get the version of Issue Credentials according to AIP1.0 or AIP2.0
   * @returns the version of this credential service
   */
  public getVersion(): CredentialProtocolVersion {
    return CredentialProtocolVersion.V1_0
  }

  /**
   * Create a {@link ProposeCredentialMessage} not bound to an existing credential exchange.
   * To create a proposal as response to an existing credential exchange, use {@link V1LegacyCredentialService#createProposalAsResponse}.
   *
   * @param proposal The object containing config options
   * @returns Object containing proposal message and associated credential record
   *
   */
  public async createProposal(
    proposal: ProposeCredentialOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    logger.debug('>> IN SERVICE V1 => createProposal')

    const connection = await this.connectionService.getById(proposal.connectionId)

    let credentialProposal: V1CredentialPreview | undefined

    const credPropose: CredPropose = proposal.credentialFormats.indy?.payload.credentialPayload as CredPropose

    if (credPropose.attributes) {
      credentialProposal = new V1CredentialPreview({ attributes: credPropose.attributes })
    }

    const config: CredentialProposeOptions = {
      credentialProposal: credentialProposal,
      credentialDefinitionId: credPropose.credentialDefinitionId,
      linkedAttachments: credPropose.linkedAttachments,
    }

    // MJR-TODO flip these params around to save a line of code
    const { message, credentialRecord } = await this.legacyCredentialService.createProposal(connection, config)

    return { credentialRecord, message }
  }

  /**
   * Processing an incoming credential message and create a credential offer as a response
   * @param proposal The object containing config options
   * @returns Object containing proposal message and associated credential record
   */
  public async acceptProposal(
    proposal: AcceptProposalOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    logger.debug('>> IN SERVICE V1 => acceptProposal')

    const credentialRecord = await this.legacyCredentialService.getById(proposal.credentialRecordId)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support credential proposal or negotiation.`
      )
    }
    const proposalCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: ProposeCredentialMessage,
    })

    if (!proposalCredentialMessage?.credentialProposal) {
      throw new AriesFrameworkError(
        `Credential record with id ${proposal.credentialRecordId} is missing required credential proposal`
      )
    }

    const credentialDefinitionId =
      proposal.credentialFormats.indy?.credentialDefinitionId ?? proposalCredentialMessage.credentialDefinitionId
    credentialRecord.linkedAttachments = proposalCredentialMessage.messageAttachment?.filter((attachment) =>
      isLinkedAttachment(attachment)
    )

    if (!credentialDefinitionId) {
      throw new AriesFrameworkError(
        'Missing required credential definition id. If credential proposal message contains no credential definition id it must be passed to config.'
      )
    }

    const { message } = await this.createOfferAsResponse(credentialRecord, {
      preview: proposalCredentialMessage.credentialProposal,
      credentialDefinitionId,
      comment: proposal.comment,
      autoAcceptCredential: proposal.autoAcceptCredential,
      attachments: credentialRecord.linkedAttachments,
    })

    return { credentialRecord, message }
  }

  /**
   * Create a {@link RequestCredentialMessage} as response to a received credential offer.
   *
   * @param credentialRecord The credential record for which to create the credential request
   * @param options Additional configuration to use for the credential request See {@link RequestCredentialOptions}
   * @returns Object containing request message and associated credential record
   *
   */
  public async createRequest(
    credentialRecord: CredentialExchangeRecord,
    options: RequestCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<RequestCredentialMessage>> {
    // mapping from RequestCredentialOptions -> CredentialRequesOptions happens
    // here
    return this.legacyCredentialService.createRequest(credentialRecord, options)
  }

  /**
   * Negotiate a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param credentialOptions configuration for the offer see {@link NegotiateProposalOptions}
   * @returns Credential record associated with the credential offer and the corresponding new offer message
   *
   */
  public async negotiateProposal(
    credentialOptions: NegotiateProposalOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    const credentialRecord = await this.legacyCredentialService.getById(credentialOptions.credentialRecordId)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support negotiation.`
      )
    }

    const credentialProposalMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: ProposeCredentialMessage,
    })

    if (!credentialProposalMessage?.credentialProposal) {
      throw new AriesFrameworkError(
        `Credential record with id ${credentialOptions.credentialRecordId} is missing required credential proposal`
      )
    }

    const credentialDefinitionId =
      credentialOptions.credentialFormats.indy?.credentialDefinitionId ??
      credentialProposalMessage.credentialDefinitionId

    if (!credentialDefinitionId) {
      throw new AriesFrameworkError(
        'Missing required credential definition id. If credential proposal message contains no credential definition id it must be passed to config.'
      )
    }

    let newCredentialProposal: V1CredentialPreview
    if (credentialOptions?.credentialFormats.indy?.attributes) {
      newCredentialProposal = new V1CredentialPreview({
        attributes: credentialOptions?.credentialFormats.indy?.attributes,
      })
    } else {
      throw Error('No proposal attributes in the negotiation options!')
    }

    const { message } = await this.createOfferAsResponse(credentialRecord, {
      preview: newCredentialProposal,
      credentialDefinitionId,
      comment: credentialOptions.comment,
      autoAcceptCredential: credentialOptions.autoAcceptCredential,
      attachments: credentialRecord.linkedAttachments,
    })
    return { credentialRecord, message }
  }

  /**
   * Negotiate a credential offer as holder (by sending a credential proposal message) to the connection
   * associated with the credential record.
   *
   * @param credentialOptions configuration for the offer see {@link NegotiateProposalOptions}
   * @returns Credential record associated with the credential offer and the corresponding new offer message
   *
   */
  public async negotiateOffer(
    credentialOptions: ProposeCredentialOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    if (!credentialOptions.credentialRecordId) {
      throw Error('No credential record id found in credential options')
    }
    const credentialRecord = await this.legacyCredentialService.getById(credentialOptions.credentialRecordId)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support negotiation.`
      )
    }
    let credentialPreview: V1CredentialPreview
    const proposal: CredPropose = credentialOptions.credentialFormats.indy?.payload.credentialPayload as CredPropose
    if (proposal.attributes) {
      credentialPreview = new V1CredentialPreview({
        attributes: proposal.attributes,
      })
      const options: CredentialProposeOptions = {
        credentialProposal: credentialPreview,
      }
      const { message } = await this.legacyCredentialService.createProposalAsResponse(credentialRecord, options)
      return { credentialRecord, message }
    }
    throw Error('Missing attributes in V1 Negotiate Offer Options')
  }

  public async createOutOfBandOffer(
    credentialOptions: OfferCredentialOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    if (!credentialOptions.credentialFormats.indy?.credentialDefinitionId) {
      throw Error('Missing credential definition id for out of band credential')
    }
    const v1Preview = new V1CredentialPreview({
      attributes: credentialOptions.credentialFormats.indy?.attributes,
    })
    const template: CredentialOfferTemplate = {
      credentialDefinitionId: credentialOptions.credentialFormats.indy?.credentialDefinitionId,
      comment: credentialOptions.comment,
      preview: v1Preview,
      autoAcceptCredential: credentialOptions.autoAcceptCredential,
    }

    const { credentialRecord, message } = await this.legacyCredentialService.createOffer(template)

    // Create and set ~service decorator
    const routing = await this.mediationRecipientService.getRouting()
    message.service = new ServiceDecorator({
      serviceEndpoint: routing.endpoints[0],
      recipientKeys: [routing.verkey],
      routingKeys: routing.routingKeys,
    })
    await this.credentialRepository.save(credentialRecord)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
    this.eventEmitter.emit<CredentialStateChangedEvent>({
      type: CredentialEventTypes.CredentialStateChanged,
      payload: {
        credentialRecord,
        previousState: null,
      },
    })
    return { credentialRecord, message }
  }
  /**
   * Create a {@link OfferCredentialMessage} not bound to an existing credential exchange.
   * To create an offer as response to an existing credential exchange, use {@link V1CredentialService#createOfferAsResponse}.
   *
   * @param credentialOptions The options containing config params for creating the credential offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOffer(
    credentialOptions: OfferCredentialOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    if (!credentialOptions.connectionId) {
      throw Error('Connection id missing from offer credential options')
    }
    const connection = await this.connectionService.getById(credentialOptions.connectionId)

    if (
      credentialOptions?.credentialFormats.indy?.attributes &&
      credentialOptions?.credentialFormats.indy?.credentialDefinitionId
    ) {
      const credentialPreview: V1CredentialPreview = new V1CredentialPreview({
        attributes: credentialOptions.credentialFormats.indy?.attributes,
      })

      const template: CredentialOfferTemplate = {
        ...credentialOptions,
        preview: credentialPreview,
        credentialDefinitionId: credentialOptions?.credentialFormats.indy?.credentialDefinitionId,
      }

      const { credentialRecord, message } = await this.legacyCredentialService.createOffer(template, connection)

      await this.credentialRepository.save(credentialRecord)
      this.eventEmitter.emit<CredentialStateChangedEvent>({
        type: CredentialEventTypes.CredentialStateChanged,
        payload: {
          credentialRecord,
          previousState: null,
        },
      })
      return { credentialRecord, message }
    }

    throw Error('Missing properties from OfferCredentialOptions object: cannot create Offer!')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getFormats(credentialFormats: V2CredProposeOfferRequestFormat): CredentialFormatService[] {
    throw new Error('Method not implemented.')
  }
}
