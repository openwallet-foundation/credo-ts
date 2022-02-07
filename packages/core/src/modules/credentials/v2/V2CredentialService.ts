/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import type { DidCommMessageRepository } from '../../../../src/storage'
import type { AgentConfig } from '../../../agent/AgentConfig'
import type { AgentMessage } from '../../../agent/AgentMessage'
import type { Dispatcher } from '../../../agent/Dispatcher'
import type { EventEmitter } from '../../../agent/EventEmitter'
import type { HandlerInboundMessage } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../logger'
import type { ConnectionService } from '../../connections/services/ConnectionService'
import type { IndyHolderService, IndyIssuerService } from '../../indy'
import type { IndyLedgerService } from '../../ledger'
import type { MediationRecipientService } from '../../routing'
import type { CredentialStateChangedEvent } from '../CredentialEvents'
import type { CredentialResponseCoordinator } from '../CredentialResponseCoordinator'
import type {
  AcceptProposalOptions,
  AcceptRequestOptions,
  NegotiateProposalOptions,
  OfferCredentialFormats,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../interfaces'
import type { CredentialRepository } from '../repository'
import type { V1LegacyCredentialService } from '../v1/V1LegacyCredentialService' // tmp
import type { CredentialAckMessage, IssueCredentialMessage } from '../v1/messages'
import type { CredentialProtocolMsgReturnType } from './CredentialMessageBuilder'
import type { CredentialFormatService, V2CredProposeOfferRequestFormat } from './formats/CredentialFormatService'
import type { V2CredentialFormatSpec } from './formats/V2CredentialFormat'

import { DidCommMessageRole } from '../../../../src/storage'
import { AriesFrameworkError } from '../../../error'
import { ConsoleLogger, LogLevel } from '../../../logger'
import { AckStatus } from '../../common'
import { CredentialEventTypes } from '../CredentialEvents'
import { CredentialProtocolVersion } from '../CredentialProtocolVersion'
import { CredentialService } from '../CredentialService'
import { CredentialState } from '../CredentialState'
import { CredentialProblemReportError, CredentialProblemReportReason } from '../errors'
import { CredentialFormatType } from '../interfaces'
import { CredentialExchangeRecord } from '../repository'

import { CredentialMessageBuilder } from './CredentialMessageBuilder'
import { FORMAT_KEYS } from './formats/CredentialFormatService'
import { IndyCredentialFormatService } from './formats/indy/IndyCredentialFormatService'
import { JsonLdCredentialFormatService } from './formats/jsonld/JsonLdCredentialFormatService'
import { V2CredentialAckHandler } from './handlers/V2CredentialAckHandler'
import { V2IssueCredentialHandler } from './handlers/V2IssueCredentialHandler'
import { V2OfferCredentialHandler } from './handlers/V2OfferCredentialHandler'
import { V2ProposeCredentialHandler } from './handlers/V2ProposeCredentialHandler'
import { V2RequestCredentialHandler } from './handlers/V2RequestCredentialHandler'
import { V2CredentialAckMessage } from './messages/V2CredentialAckMessage'
import { V2IssueCredentialMessage } from './messages/V2IssueCredentialMessage'
import { V2OfferCredentialMessage } from './messages/V2OfferCredentialMessage'
import { V2ProposeCredentialMessage } from './messages/V2ProposeCredentialMessage'
import { V2RequestCredentialMessage } from './messages/V2RequestCredentialMessage'

const logger = new ConsoleLogger(LogLevel.info)

export class V2CredentialService extends CredentialService {
  private credentialService: V1LegacyCredentialService // Temporary while v1 constructor needs this
  private connectionService: ConnectionService
  private credentialRepository: CredentialRepository
  private eventEmitter: EventEmitter
  private agentConfig: AgentConfig
  private credentialResponseCoordinator: CredentialResponseCoordinator
  private dispatcher: Dispatcher
  private logger: Logger
  private indyIssuerService: IndyIssuerService
  private indyLedgerService: IndyLedgerService
  private indyHolderService: IndyHolderService
  private didCommMessageRepository: DidCommMessageRepository
  private mediationRecipientService: MediationRecipientService
  private credentialMessageBuilder: CredentialMessageBuilder

  public constructor(
    connectionService: ConnectionService,
    credentialService: V1LegacyCredentialService,
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    msgSender: MessageSender,
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    credentialResponseCoordinator: CredentialResponseCoordinator,
    indyIssuerService: IndyIssuerService,
    mediationRecipientService: MediationRecipientService,
    indyLedgerService: IndyLedgerService,
    indyHolderService: IndyHolderService,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    super()
    this.credentialRepository = credentialRepository
    this.eventEmitter = eventEmitter
    this.credentialService = credentialService
    this.connectionService = connectionService
    this.agentConfig = agentConfig
    this.credentialResponseCoordinator = credentialResponseCoordinator
    this.dispatcher = dispatcher
    this.logger = agentConfig.logger
    this.indyIssuerService = indyIssuerService
    this.mediationRecipientService = mediationRecipientService
    this.indyLedgerService = indyLedgerService
    this.indyHolderService = indyHolderService
    this.credentialMessageBuilder = new CredentialMessageBuilder()
    this.didCommMessageRepository = didCommMessageRepository
  }
  /**
   * Returns the protocol version for this credential service
   * @returns v2 as this is the v2 service
   */
  public getVersion(): CredentialProtocolVersion {
    return CredentialProtocolVersion.V2_0
  }

  /**
   * Gets the correct formatting service for this credential record type, eg indy or jsonld. Others may be
   * added in the future.
   * Each formatting service knows how to format the message structure for the specific record type
   * @param credentialFormatType the format type, indy, jsonld, jwt etc.
   * @returns the formatting service.
   */
  public getFormatService(credentialFormatType: CredentialFormatType): CredentialFormatService {
    const serviceFormatMap = {
      [CredentialFormatType.Indy]: IndyCredentialFormatService,
      [CredentialFormatType.JsonLd]: JsonLdCredentialFormatService,
    }
    return new serviceFormatMap[credentialFormatType](
      this.credentialRepository,
      this.eventEmitter,
      this.didCommMessageRepository,
      this.indyIssuerService,
      this.indyLedgerService,
      this.indyHolderService
    )
  }

  /**
   * Create a {@link V2ProposeCredentialMessage} not bound to an existing credential exchange.
   *
   * @param proposal The ProposeCredentialOptions object containing the important fields for the credential message
   * @returns Object containing proposal message and associated credential record
   *
   */
  public async createProposal(
    proposal: ProposeCredentialOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    // should handle all formats in proposal.credentialFormats by querying and calling
    // its corresponding handler classes.
    logger.debug('>> IN SERVICE V2 createProposal')

    logger.debug('Get the Format Service and Create Proposal Message')

    const formats: CredentialFormatService[] = this.getFormats(proposal.credentialFormats)

    const { message: proposalMessage, credentialRecord } = this.credentialMessageBuilder.createProposal(
      formats,
      proposal
    )

    credentialRecord.credentialAttributes = proposalMessage.credentialProposal?.attributes

    logger.debug('Save meta data and emit state change event')

    // Q: How do we set the meta data when there are multiple formats?
    for (const format of formats) {
      await format.getMetaDataService().setMetaDataForProposal(proposal.credentialFormats, credentialRecord)
    }

    await this.credentialRepository.save(credentialRecord)

    this.eventEmitter.emit<CredentialStateChangedEvent>({
      type: CredentialEventTypes.CredentialStateChanged,
      payload: {
        credentialRecord,
        previousState: null,
      },
    })

    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: proposalMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

    return { credentialRecord, message: proposalMessage }
  }

  /**
   * Get all the format service objects for a given credential format from an incoming message
   * @param messageFormats the format objects containing the format name (eg indy)
   * @return the credential format service objects in an array - derived from format object keys
   */
  public getFormatsFromMessage(messageFormats: V2CredentialFormatSpec[]): CredentialFormatService[] {
    const formats: CredentialFormatService[] = []
    for (const msg of messageFormats) {
      if (msg.format.includes('indy')) {
        formats.push(this.getFormatService(CredentialFormatType.Indy))
      } else if (msg.format.includes('aries')) {
        formats.push(this.getFormatService(CredentialFormatType.JsonLd))
      } else {
        throw Error(`Unknown Message Format: ${msg.format}`)
      }
    }
    return formats
  }
  /**
   * Get all the format service objects for a given credential format
   * @param credentialFormats the format object containing various optional parameters
   * @return the credential format service objects in an array - derived from format object keys
   */
  public getFormats(
    credentialFormats: OfferCredentialFormats | V2CredProposeOfferRequestFormat
  ): CredentialFormatService[] {
    const formats: CredentialFormatService[] = []
    const formatKeys = Object.keys(credentialFormats)

    for (const key of formatKeys) {
      const credentialFormatType: CredentialFormatType = FORMAT_KEYS[key]
      const formatService: CredentialFormatService = this.getFormatService(credentialFormatType)
      formats.push(formatService)
    }
    return formats
  }
  /**
   * Method called by {@link V2ProposeCredentialHandler} on reception of a propose credential message
   * We do the necessary processing here to accept the proposal and do the state change, emit event etc.
   * @param messageContext the inbound propose credential message
   * @returns credential record appropriate for this incoming message (once accepted)
   */
  public async processProposal(
    messageContext: HandlerInboundMessage<V2ProposeCredentialHandler>
  ): Promise<CredentialExchangeRecord> {
    let credentialRecord: CredentialExchangeRecord
    const { message: proposalMessage, connection } = messageContext

    this.logger.debug(`Processing credential proposal with id ${proposalMessage.id}`)

    // get the format service here to format correctly...

    try {
      // Credential record already exists
      credentialRecord = await this.getByThreadAndConnectionId(proposalMessage.threadId, connection?.id)
      // Assert
      // this may not be the first proposal message...
      let proposalCredentialMessage, offerCredentialMessage
      try {
        proposalCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
          associatedRecordId: credentialRecord.id,
          messageClass: V2ProposeCredentialMessage,
        })
        offerCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
          associatedRecordId: credentialRecord.id,
          messageClass: V2OfferCredentialMessage,
        })
      } catch (RecordNotFoundError) {
        // record not found - expected (sometimes)
      }
      credentialRecord.assertState(CredentialState.OfferSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: proposalCredentialMessage,
        previousSentMessage: offerCredentialMessage,
      })

      // Update record
      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: proposalMessage,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialRecord.id,
      })
      await this.updateState(credentialRecord, CredentialState.ProposalReceived)
    } catch {
      //   // No credential record exists with thread id
      logger.debug('TEST-DEBUG No credential record exists')

      // get the format service objects for the formats found in the message
      const formats: CredentialFormatService[] = this.getFormatsFromMessage(proposalMessage.formats)

      credentialRecord = this.credentialMessageBuilder.acceptProposal(proposalMessage, connection?.id)

      // Save record and emit event
      this.connectionService.assertConnectionOrServiceDecorator(messageContext)

      // use the attach id in the formats object to find the correct attachment
      for (const format of formats) {
        const attachment = format.getAttachment(proposalMessage)
        if (attachment) {
          const credProposal: V2CredProposeOfferRequestFormat | undefined = format.getCredentialPayload(attachment)
          if (credProposal) {
            format.getMetaDataService().setMetaDataForProposal(credProposal, credentialRecord)
          }
        }
      }
      await this.credentialRepository.save(credentialRecord)
      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: proposalMessage,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialRecord.id,
      })
      await this.emitEvent(credentialRecord)
    }
    return credentialRecord
  }

  private async emitEvent(credentialRecord: CredentialExchangeRecord) {
    this.eventEmitter.emit<CredentialStateChangedEvent>({
      type: CredentialEventTypes.CredentialStateChanged,
      payload: {
        credentialRecord,
        previousState: null,
      },
    })
  }
  /**
   * Retrieve a credential record by connection id and thread id
   *
   * @param connectionId The connection id
   * @param threadId The thread id
   * @throws {RecordNotFoundError} If no record is found
   * @throws {RecordDuplicateError} If multiple records are found
   * @returns The credential record
   */
  public getByThreadAndConnectionId(threadId: string, connectionId?: string): Promise<CredentialExchangeRecord> {
    return this.credentialRepository.getSingleByQuery({
      connectionId,
      threadId,
    })
  }

  public async acceptProposal(
    proposal: AcceptProposalOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    this.logger.debug('>> IN SERVICE V2 => acceptProposal')

    const credentialRecord = await this.credentialService.getById(proposal.credentialRecordId)
    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support credential proposal or negotiation.`
      )
    }
    const proposeCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2ProposeCredentialMessage,
    })

    if (!proposeCredentialMessage?.credentialProposal) {
      throw new AriesFrameworkError(
        `Credential record with id ${proposal.credentialRecordId} is missing required credential proposal`
      )
    }

    // only do this if Indy format present in the message
    // credential preview is Indy specific

    // MJR-TODO not sure we need this; is this done inside createOfferAsResponse anyway??
    for (const msg of proposeCredentialMessage.formats) {
      if (msg.format.includes('indy')) {
        const formatService: CredentialFormatService = this.getFormatService(CredentialFormatType.Indy)

        this.credentialMessageBuilder.setPreview(formatService, proposal, proposeCredentialMessage?.credentialProposal)
      }
    }

    const message = await this.createOfferAsResponse(credentialRecord, proposal)

    return { credentialRecord, message }
  }

  /**
   * Create a {@link OfferCredentialMessage} as response to a received credential proposal.
   * To create an offer not bound to an existing credential exchange, use {@link V2CredentialService#createOffer}.
   *
   * @param credentialRecord The credential record for which to create the credential offer
   * @param credentialTemplate The credential template to use for the offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOfferAsResponse(
    credentialRecord: CredentialExchangeRecord,
    proposal: AcceptProposalOptions | NegotiateProposalOptions
  ): Promise<V2OfferCredentialMessage> {
    // Assert
    credentialRecord.assertState(CredentialState.ProposalReceived)

    const formats: CredentialFormatService[] = this.getFormats(proposal.credentialFormats as Record<string, unknown>)

    // Create the offer message
    logger.debug('Get the Format Service and Create Offer Message')
    const credentialOfferMessage = await this.credentialMessageBuilder.createOfferAsResponse(
      formats,
      credentialRecord,
      proposal
    )

    await this.updateState(credentialRecord, CredentialState.OfferSent)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: credentialOfferMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

    return credentialOfferMessage
  }

  /**
   * Method called by {@link V2OfferCredentialHandler} on reception of a offer credential message
   * We do the necessary processing here to accept the offer and do the state change, emit event etc.
   * @param messageContext the inbound offer credential message
   * @returns credential record appropriate for this incoming message (once accepted)
   */
  public async processOffer(
    messageContext: HandlerInboundMessage<V2OfferCredentialHandler>
  ): Promise<CredentialExchangeRecord> {
    let credentialRecord: CredentialExchangeRecord
    const { message: credentialOfferMessage, connection } = messageContext

    logger.debug(`Processing credential offer with id ${credentialOfferMessage.id}`)

    const formats: CredentialFormatService[] = this.getFormatsFromMessage(credentialOfferMessage.formats)
    let credOffer: V2CredProposeOfferRequestFormat | undefined

    try {
      // Credential record already exists
      credentialRecord = await this.getByThreadAndConnectionId(credentialOfferMessage.threadId, connection?.id)

      // Assert
      let proposeCredentialMessage, offerCredentialMessage

      try {
        proposeCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
          associatedRecordId: credentialRecord.id,
          messageClass: V2ProposeCredentialMessage,
        })
        offerCredentialMessage = await this.didCommMessageRepository.getAgentMessage({
          associatedRecordId: credentialRecord.id,
          messageClass: V2OfferCredentialMessage,
        })
      } catch (error) {
        // record not found error - MJR-TODO is this ok?
      }

      credentialRecord.assertState(CredentialState.ProposalSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: offerCredentialMessage,
        previousSentMessage: proposeCredentialMessage,
      })

      for (const format of formats) {
        const attachment = format.getAttachment(credentialOfferMessage)
        if (attachment) {
          credOffer = format.getCredentialPayload(attachment)

          if (!credOffer) {
            throw new CredentialProblemReportError(
              `Missing required base64 or json encoded attachment data for credential offer with thread id ${credentialOfferMessage.threadId}`,
              { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
            )
          }
        } else {
          throw new CredentialProblemReportError(
            `Missing required attachment for credential offer with thread id ${credentialOfferMessage.threadId}`,
            { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
          )
        }
        logger.debug('Save metadata for offer')
        if (credOffer) {
          format.getMetaDataService().setMetaDataForOffer(credOffer, credentialRecord)
          await this.updateState(credentialRecord, CredentialState.OfferReceived)
        }
      }

      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: credentialOfferMessage,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialRecord.id,
      })
    } catch {
      // No credential record exists with thread id

      logger.debug('No credential record found for this offer - create a new one')

      credentialRecord = new CredentialExchangeRecord({
        connectionId: connection?.id,
        threadId: credentialOfferMessage.id,
        credentialAttributes: credentialOfferMessage.credentialPreview?.attributes,
        state: CredentialState.OfferReceived,
      })

      for (const format of formats) {
        const attachment = format.getAttachment(credentialOfferMessage)
        if (attachment) {
          credOffer = format.getCredentialPayload(attachment)

          if (!credOffer) {
            throw new CredentialProblemReportError(
              `Missing required base64 or json encoded attachment data for credential offer with thread id ${credentialOfferMessage.threadId}`,
              { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
            )
          }
        } else {
          throw new CredentialProblemReportError(
            `Missing required attachment for credential offer with thread id ${credentialOfferMessage.threadId}`,
            { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
          )
        }
        if (credOffer) {
          format.getMetaDataService().setMetaDataForOffer(credOffer, credentialRecord)
        }
      }
      // Save in repository
      logger.debug('Saving credential record and emit offer-received event')
      await this.credentialRepository.save(credentialRecord)

      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: credentialOfferMessage,
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
    }

    return credentialRecord
  }

  /**
   * Register the v2 handlers. These handlers supplement, ie are created in addition to, the existing
   * v1 handlers.
   */
  public registerHandlers() {
    logger.debug('Registering V2 handlers...')
    logger.debug('  => V2ProposeCredentialHandler')

    this.dispatcher.registerHandler(
      new V2ProposeCredentialHandler(
        this,
        this.agentConfig,
        this.credentialResponseCoordinator,
        this.didCommMessageRepository
      )
    )

    logger.debug('  => V2OfferCredentialHandler')
    this.dispatcher.registerHandler(
      new V2OfferCredentialHandler(
        this,
        this.agentConfig,
        this.credentialResponseCoordinator,
        this.mediationRecipientService,
        this.didCommMessageRepository
      )
    )

    logger.debug('  => V2RequestCredentialHandler')
    this.dispatcher.registerHandler(
      new V2RequestCredentialHandler(
        this,
        this.agentConfig,
        this.credentialResponseCoordinator,
        this.didCommMessageRepository
      )
    )

    logger.debug('  => V2IssueCredentialHandler')
    this.dispatcher.registerHandler(
      new V2IssueCredentialHandler(
        this,
        this.agentConfig,
        this.credentialResponseCoordinator,
        this.didCommMessageRepository
      )
    )

    logger.debug('  => V2CredentialAckHandler')
    this.dispatcher.registerHandler(new V2CredentialAckHandler(this))
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param credentialRecord The credential record to update the state for
   * @param newState The state to update to
   *
   */
  public async updateState(credentialRecord: CredentialExchangeRecord, newState: CredentialState) {
    const previousState = credentialRecord.state
    credentialRecord.state = newState
    await this.credentialRepository.update(credentialRecord)

    this.eventEmitter.emit<CredentialStateChangedEvent>({
      type: CredentialEventTypes.CredentialStateChanged,
      payload: {
        credentialRecord,
        previousState: previousState,
      },
    })
  }

  /**
   * Create a {@link V2RequestCredentialMessage}
   *
   * @param credentialRecord The credential record for which to create the credential request
   * @param options request options for creating this request
   * @returns Object containing request message and associated credential record
   *
   */
  public async createRequest(
    record: CredentialExchangeRecord,
    options: RequestCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<V2RequestCredentialMessage>> {
    logger.debug('>> IN SERVICE V2 createRequest')

    logger.debug('Get the Format Service and Create Request Message')

    record.assertState(CredentialState.OfferReceived)

    const credentialOffer = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: record.id,
      messageClass: V2OfferCredentialMessage,
    })

    if (!credentialOffer) {
      throw new CredentialProblemReportError(
        `Missing required base64 or json encoded attachment data for credential offer with thread id ${record.threadId}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }
    const formats: CredentialFormatService[] = this.getFormatsFromMessage(credentialOffer.formats)
    if (formats) {
      const { message, credentialRecord } = await this.credentialMessageBuilder.createRequest(formats, record, options)

      await this.updateState(credentialRecord, CredentialState.RequestSent)
      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: message,
        role: DidCommMessageRole.Receiver,
        associatedRecordId: credentialRecord.id,
      })
      return { message, credentialRecord }
    } else {
      throw Error('No format keys found on the RequestCredentialOptions object')
    }
  }

  /**
   * Process a received {@link RequestCredentialMessage}. This will not accept the credential request
   * or send a credential. It will only update the existing credential record with
   * the information from the credential request message. Use {@link V1LegacyCredentialService#createCredential}
   * after calling this method to create a credential.
   *
   * @param messageContext The message context containing a v2 credential request message
   * @returns credential record associated with the credential request message
   *
   */
  public async processRequest(
    messageContext: InboundMessageContext<V2RequestCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    const { message: credentialRequestMessage, connection } = messageContext

    logger.debug('>> IN SERVICE V2 processRequest')

    logger.debug('Looking for a credential record')

    const credentialRecord = await this.getByThreadAndConnectionId(credentialRequestMessage.threadId, connection?.id)

    logger.debug('Got a credential record!')
    let proposalMessage, offerMessage
    try {
      proposalMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2ProposeCredentialMessage,
      })
    } catch {
      // record not found - this can happen
    }
    try {
      offerMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2OfferCredentialMessage,
      })
    } catch (error) {
      // record not found - this can happen
    }
    // Assert
    credentialRecord.assertState(CredentialState.OfferSent)
    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: proposalMessage,
      previousSentMessage: offerMessage,
    })

    this.logger.debug('Credential record found when processing credential request', credentialRecord)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: credentialRequestMessage,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
    logger.debug('-----> UPDATING STATE TO REQUEST RECEIVED')
    await this.updateState(credentialRecord, CredentialState.RequestReceived)

    return credentialRecord
  }

  /**
   * Negotiate a credential proposal as issuer (by sending a credential offer message) to the connection
   * associated with the credential record.
   *
   * @param credentialOptions configuration for the offer see {@link NegotiateProposalOptions}
   * @returns Credential exchange record associated with the credential offer
   *
   */
  public async negotiateProposal(
    credentialOptions: NegotiateProposalOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: AgentMessage }> {
    const credentialRecord = await this.credentialService.getById(credentialOptions.credentialRecordId)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support negotiation.`
      )
    }
    let proposalMessage
    try {
      proposalMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2ProposeCredentialMessage,
      })
    } catch {
      // record not found - this can happen
    }

    if (!proposalMessage?.credentialProposal) {
      throw new AriesFrameworkError(
        `Credential record with id ${credentialOptions.credentialRecordId} is missing required credential proposal`
      )
    }

    const message = await this.createOfferAsResponse(credentialRecord, credentialOptions)

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
      throw Error('No credential record id found in propose options')
    }
    const credentialRecord = await this.credentialService.getById(credentialOptions.credentialRecordId)

    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support negotiation.`
      )
    }
    const { message } = await this.createProposalAsResponse(credentialRecord, credentialOptions)

    return { credentialRecord, message }
  }

  /**
   * Create a {@link ProposePresentationMessage} as response to a received credential offer.
   * To create a proposal not bound to an existing credential exchange, use {@link V1LegacyCredentialService#createProposal}.
   *
   * @param credentialRecord The credential record for which to create the credential proposal
   * @param config Additional configuration to use for the proposal
   * @returns Object containing proposal message and associated credential record
   *
   */
  public async createProposalAsResponse(
    credentialRecord: CredentialExchangeRecord,
    options: ProposeCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<V2ProposeCredentialMessage>> {
    // Assert
    credentialRecord.assertState(CredentialState.OfferReceived)

    // Create message

    const formats: CredentialFormatService[] = this.getFormats(options.credentialFormats)

    const { message } = this.credentialMessageBuilder.createProposal(formats, options)
    message.setThread({ threadId: credentialRecord.threadId })

    // Update record
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })
    credentialRecord.credentialAttributes = message.credentialProposal?.attributes
    this.updateState(credentialRecord, CredentialState.ProposalSent)

    return { message: message, credentialRecord }
  }
  /**
   * Create a {@link V2OfferCredentialMessage} as begonning of protocol process.
   *
   * @param formatService {@link CredentialFormatService} the format service object containing format-specific logic
   * @param options attributes of the original offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOffer(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    credentialOptions: OfferCredentialOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: V2OfferCredentialMessage }> {
    const connection = await this.connectionService.getById(credentialOptions.connectionId)

    connection?.assertReady()

    const formats: CredentialFormatService[] = this.getFormats(credentialOptions.credentialFormats)

    // Create message
    const { credentialRecord, message } = await this.credentialMessageBuilder.createOffer(formats, credentialOptions)

    for (const format of formats) {
      const attachment = format.getAttachment(message)
      if (attachment) {
        const credOffer: V2CredProposeOfferRequestFormat | undefined = format.getCredentialPayload(attachment)
        if (credOffer) {
          format.getMetaDataService().setMetaDataForOffer(credOffer, credentialRecord)
        }
      }
    }
    await this.credentialRepository.save(credentialRecord)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
    await this.emitEvent(credentialRecord)
    return { credentialRecord, message }
  }

  /**
   * Create a {@link AcceptProposalOptions} object used by handler
   *
   * @param credentialRecord {@link CredentialRecord} the record containing the proposal
   * @return options attributes of the proposal
   *
   */
  public async createAcceptProposalOptions(credentialRecord: CredentialExchangeRecord): Promise<AcceptProposalOptions> {
    let proposalMessage
    try {
      proposalMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2ProposeCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      // record not found - expected (sometimes)
    }

    if (proposalMessage && proposalMessage.credentialProposal?.attributes) {
      const msg: V2ProposeCredentialMessage = proposalMessage as V2ProposeCredentialMessage
      const formats: CredentialFormatService[] = this.getFormatsFromMessage(msg.formats)

      let options: AcceptProposalOptions = {
        connectionId: '',
        protocolVersion: CredentialProtocolVersion.V2_0,
        credentialRecordId: credentialRecord.id,
        credentialFormats: {},
      }

      for (const formatService of formats) {
        options = await formatService.processProposal(options, credentialRecord)
      }

      const proposeMessage: V2ProposeCredentialMessage = proposalMessage as V2ProposeCredentialMessage
      if (proposeMessage && proposeMessage.credentialProposal) {
        options.credentialRecordId = credentialRecord.id
        options.credentialFormats = {
          indy: {
            attributes: proposeMessage.credentialProposal.attributes,
            credentialDefinitionId: options.credentialFormats.indy?.credentialDefinitionId,
          },
        }
      }

      return options
    }
    throw Error('Unable to create accept proposal options object')
  }

  /**
   * Create a {@link IssueCredentialMessage} as response to a received credential request.
   *
   * @param credentialRecord The credential record for which to create the credential
   * @param options Additional configuration to use for the credential
   * @returns Object containing issue credential message and associated credential record
   *
   */
  public async createCredential(
    record: CredentialExchangeRecord,
    options: AcceptRequestOptions
  ): Promise<CredentialProtocolMsgReturnType<IssueCredentialMessage | V2IssueCredentialMessage>> {
    record.assertState(CredentialState.RequestReceived)

    let offerMessage
    try {
      offerMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: record.id,
        messageClass: V2OfferCredentialMessage,
      })
    } catch (error) {
      // record not found - this can happen
    }
    if (!offerMessage) {
      // this needs to change in W3C - there might not be an offer
      throw Error('No offer message found - cannot create credential')
    }
    const credentialFormats: CredentialFormatService[] = this.getFormatsFromMessage(offerMessage.formats)
    const { message: issueCredentialMessage, credentialRecord } = await this.credentialMessageBuilder.createCredential(
      credentialFormats,
      record,
      options
    )

    issueCredentialMessage.setThread({
      threadId: credentialRecord.threadId,
    })
    issueCredentialMessage.setPleaseAck()

    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: issueCredentialMessage,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })
    credentialRecord.autoAcceptCredential = options?.autoAcceptCredential ?? credentialRecord.autoAcceptCredential

    await this.updateState(credentialRecord, CredentialState.CredentialIssued)

    return { message: issueCredentialMessage, credentialRecord }
  }

  /**
   * Process a received {@link IssueCredentialMessage}. This will not accept the credential
   * or send a credential acknowledgement. It will only update the existing credential record with
   * the information from the issue credential message. Use {@link V1LegacyCredentialService#createAck}
   * after calling this method to create a credential acknowledgement.
   *
   * @param messageContext The message context containing an issue credential message
   *
   * @returns credential record associated with the issue credential message
   *
   */
  public async processCredential(
    messageContext: InboundMessageContext<V2IssueCredentialMessage>
  ): Promise<CredentialExchangeRecord> {
    logger.debug('>> IN SERVICE V2 processCredential')

    const { message: issueCredentialMessage, connection } = messageContext

    this.logger.debug(`Processing credential with id ${issueCredentialMessage.id}`)

    const credentialRecord = await this.getByThreadAndConnectionId(issueCredentialMessage.threadId, connection?.id)

    let requestMessage, offerMessage
    try {
      requestMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2RequestCredentialMessage,
      })
      offerMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2OfferCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      // record not found - expected (sometimes)
    }
    // Assert
    credentialRecord.assertState(CredentialState.RequestSent)
    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: offerMessage,
      previousSentMessage: requestMessage,
    })

    const formatServices: CredentialFormatService[] = this.getFormatsFromMessage(issueCredentialMessage.formats)

    for (const formatService of formatServices) {
      await formatService.processCredential(issueCredentialMessage, credentialRecord)
    }

    await this.updateState(credentialRecord, CredentialState.CredentialReceived)
    await this.didCommMessageRepository.saveAgentMessage({
      agentMessage: issueCredentialMessage,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
    logger.debug('>>>>>>>>>>>>>> Credential stored in user wallet')

    return credentialRecord
  }

  /**
   * Create a {@link V2CredentialAckMessage} as response to a received credential.
   *
   * @param credentialRecord The credential record for which to create the credential acknowledgement
   * @returns Object containing credential acknowledgement message and associated credential record
   *
   */
  public async createAck(
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialProtocolMsgReturnType<V2CredentialAckMessage>> {
    logger.debug('>> IN SERVICE V2 createAck')

    credentialRecord.assertState(CredentialState.CredentialReceived)

    // Create message
    const ackMessage = new V2CredentialAckMessage({
      status: AckStatus.OK,
      threadId: credentialRecord.threadId,
    })

    await this.updateState(credentialRecord, CredentialState.Done)

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
    messageContext: InboundMessageContext<CredentialAckMessage | V2CredentialAckMessage>
  ): Promise<CredentialExchangeRecord> {
    logger.debug('>> IN SERVICE V2 processAck')

    const { message: credentialAckMessage, connection } = messageContext

    this.logger.debug(`Processing credential ack with id ${credentialAckMessage.id}`)

    const credentialRecord = await this.getByThreadAndConnectionId(credentialAckMessage.threadId, connection?.id)

    let requestMessage, credentialMessage
    try {
      requestMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2RequestCredentialMessage,
      })
      credentialMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2IssueCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      // record not found - expected (sometimes)
    }
    // Assert
    credentialRecord.assertState(CredentialState.CredentialIssued)
    this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
      previousReceivedMessage: requestMessage,
      previousSentMessage: credentialMessage,
    })

    // Update record
    await this.updateState(credentialRecord, CredentialState.Done)

    return credentialRecord
  }

  public update(credentialRecord: CredentialExchangeRecord) {
    return this.credentialRepository.update(credentialRecord)
  }
}
