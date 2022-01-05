import { AgentMessage, AgentConfig, MessageSender, CredentialState, CredentialStateChangedEvent, CredentialEventTypes, AriesFrameworkError, IndyLedgerService } from '@aries-framework/core'
import { CredentialService } from '../CredentialService'
import { AcceptProposalOptions, ProposeCredentialOptions, V2CredOfferFormat, V2CredProposalFormat } from './interfaces'
import { CredentialRecord, CredentialRepository } from '../repository'
import { EventEmitter } from '../../../agent/EventEmitter'
import { CredentialRecordType } from './CredentialExchangeRecord'
import { CredentialFormatService } from './formats/CredentialFormatService'
import { unitTestLogger } from '../../../logger'
import type { Logger } from '../../../logger'
import { CredentialProtocolVersion } from '../CredentialProtocolVersion'
import { IndyCredentialFormatService } from './formats/indy/IndyCredentialFormatService'
import { JsonLdCredentialFormatService } from './formats/jsonld/JsonLdCredentialFormatService'
import { CredentialMessageBuilder } from './CredentialMessageBuilder'
import { Lifecycle, scoped } from 'tsyringe'
import { V1LegacyCredentialService } from '../v1/V1LegacyCredentialService' // tmp
import { ConnectionService } from '../../connections/services/ConnectionService'
import { HandlerInboundMessage } from 'packages/core/src/agent/Handler'
import { V2ProposeCredentialHandler } from './handlers/V2ProposeCredentialHandler'
import { Dispatcher } from '../../../agent/Dispatcher'
import { CredentialResponseCoordinator } from '../CredentialResponseCoordinator'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { V2OfferCredentialMessage } from './messages/V2OfferCredentialMessage'
import { IndyHolderService, IndyIssuerService } from '../../indy'
import { V2OfferCredentialHandler } from './handlers/V2OfferCredentialHandler'
import { MediationRecipientService } from '../../routing'
import { CredentialProblemReportError, CredentialProblemReportReason } from '../errors'
import { isLinkedAttachment } from '../../../utils/attachment'



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
    mediationRecipientService: MediationRecipientService
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
    this.credentialMessageBuilder = new CredentialMessageBuilder()

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
   * @param _credentialRecordType the record type, indy, jsonld, jwt etc.
   * @returns the formatting service.
   */
  public getFormatService(_credentialRecordType: CredentialRecordType): CredentialFormatService {

    const serviceFormatMap = {
      [CredentialRecordType.INDY]: IndyCredentialFormatService,
      [CredentialRecordType.W3C]: JsonLdCredentialFormatService,
    }
    return new serviceFormatMap[_credentialRecordType](this.credentialRepository, this.eventEmitter, this.indyIssuerService)
  }

  /**
   * Create a {@link V2ProposeCredentialMessage} not bound to an existing credential exchange.
   *
   * @param proposal The ProposeCredentialOptions object containing the important fields for the credential message
   * @returns Object containing proposal message and associated credential record
   *
   */
  public async createProposal(proposal: ProposeCredentialOptions): Promise<{ credentialRecord: CredentialRecord, message: AgentMessage }> {
    // should handle all formats in proposal.credentialFormats by querying and calling
    // its corresponding handler classes.
    const connection = await this.connectionService.getById(proposal.connectionId)

    unitTestLogger(">> IN SERVICE V2 createProposal")
    const credentialRecordType = proposal.credentialFormats.indy ? CredentialRecordType.INDY : CredentialRecordType.W3C

    unitTestLogger("Get the Format Service and Create Proposal Message")

    const formatService: CredentialFormatService = this.getFormatService(credentialRecordType)

    const { message, credentialRecord } = this.credentialMessageBuilder.createProposal(formatService, proposal, connection.threadId)
    
    unitTestLogger("Save meta data and emit state change event")
    await formatService.setMetaDataAndEmitEventForProposal(proposal.credentialFormats, credentialRecord)

    return { credentialRecord, message }
  }

  /**
   * Method called by {@link V2ProposeCredentialHandler} on reception of a propose credential message
   * We do the necessary processin here to accept the proposal and do the state change, emit event etc.
   * @param messageContext the inbound propose credential message
   * @returns credential record appropriate for this incoming message (once accepted)
   */
  public async processProposal(messageContext: HandlerInboundMessage<V2ProposeCredentialHandler>): Promise<CredentialRecord> {
    let credentialRecord: CredentialRecord
    const { message: proposalMessage, connection } = messageContext

    this.logger.debug(`Processing credential proposal with id ${proposalMessage.id}`)

    // get the format service here to format correctly...

    try {
      // Credential record already exists
      credentialRecord = await this.getByThreadAndConnectionId(proposalMessage.threadId, connection?.id)
      // Assert

      credentialRecord.assertState(CredentialState.OfferSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: credentialRecord.proposalMessage,
        previousSentMessage: credentialRecord.offerMessage,
      })

      // Update record
      credentialRecord.proposalMessage = proposalMessage
      await this.updateState(credentialRecord, CredentialState.ProposalReceived)
    } catch {
      //   // No credential record exists with thread id

      console.log("TEST-DEBUG No credential record exists")

      // get the format service based on the preview id

      const credentialRecordType = proposalMessage.filtersAttach[0].id === 'indy' ? CredentialRecordType.INDY : CredentialRecordType.W3C

      const formatService: CredentialFormatService = this.getFormatService(credentialRecordType)

      credentialRecord = this.credentialMessageBuilder.acceptProposal(formatService, proposalMessage, connection?.id)

      // Save record and emit event
      this.connectionService.assertConnectionOrServiceDecorator(messageContext)

      let options: V2CredProposalFormat
      if (proposalMessage.filtersAttach[0].data.base64) {
        options = JsonEncoder.fromBase64(proposalMessage.filtersAttach[0].data.base64)
        formatService.setMetaDataAndEmitEventForProposal(options, credentialRecord)
      }
    }
    return credentialRecord
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
  public getByThreadAndConnectionId(threadId: string, connectionId?: string): Promise<CredentialRecord> {
    return this.credentialRepository.getSingleByQuery({
      connectionId,
      threadId,
    })
  }

  public async acceptProposal(proposal: AcceptProposalOptions): Promise<{ credentialRecord: CredentialRecord, message: AgentMessage }> {
    this.logger.debug(">> IN SERVICE V2 => acceptProposal")

    const credentialRecord = await this.credentialService.getById(proposal.credentialRecordId)
    if (!credentialRecord.connectionId) {
      throw new AriesFrameworkError(
        `No connectionId found for credential record '${credentialRecord.id}'. Connection-less issuance does not support credential proposal or negotiation.`
      )
    }
    const credentialProposalMessage = credentialRecord.proposalMessage
    if (!credentialProposalMessage?.credentialProposal) {
      throw new AriesFrameworkError(
        `Credential record with id ${proposal.credentialRecordId} is missing required credential proposal`
      )
    }

    const credentialDefinitionId = proposal.credentialFormats.indy?.credentialDefinitionId ?? credentialProposalMessage.credentialDefinitionId

    if (!credentialDefinitionId) {
      throw new AriesFrameworkError(
        'Missing required credential definition id. If credential proposal message contains no credential definition id it must be passed to config.'
      )
    }

    const message = await this.createOfferAsResponse(credentialRecord, proposal)

    await this.updateState(credentialRecord, CredentialState.OfferSent)

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
    credentialRecord: CredentialRecord,
    proposal: AcceptProposalOptions): Promise<V2OfferCredentialMessage> {
    // Assert
    credentialRecord.assertState(CredentialState.ProposalReceived)

    // Create the offer message
    unitTestLogger("Get the Format Service and Create Proposal Message")
    const credentialRecordType = proposal.credentialFormats.indy ? CredentialRecordType.INDY : CredentialRecordType.W3C

    const formatService: CredentialFormatService = this.getFormatService(credentialRecordType)

    return await this.credentialMessageBuilder.createOfferAsResponse(formatService, credentialRecord, proposal)
  }

  /**
   * Method called by {@link V2OfferCredentialHandler} on reception of a offer credential message
   * We do the necessary processing here to accept the offer and do the state change, emit event etc.
   * @param messageContext the inbound offer credential message
   * @returns credential record appropriate for this incoming message (once accepted)
   */
  public async processOffer(messageContext: HandlerInboundMessage<V2OfferCredentialHandler>): Promise<CredentialRecord> {
    let credentialRecord: CredentialRecord
    const { message: credentialOfferMessage, connection } = messageContext

    unitTestLogger(`Processing credential offer with id ${credentialOfferMessage.id}`)
    unitTestLogger(`CredentialOfferMessage message = ${credentialOfferMessage}`)

    const credentialRecordType = credentialOfferMessage.offerAttachments[0].id == 'indy' ? CredentialRecordType.INDY : CredentialRecordType.W3C

    unitTestLogger(`Found a message of type: ${credentialRecordType}`)

    const formatService: CredentialFormatService = this.getFormatService(credentialRecordType)

    // get the format specific cred offer
    const credOffer: V2CredOfferFormat = formatService.getCredentialOfferMessage(credentialOfferMessage)

    unitTestLogger("indy credential offer = " + credOffer)

    if (!credOffer) {
      throw new CredentialProblemReportError(
        `Missing required base64 or json encoded attachment data for credential offer with thread id ${credentialOfferMessage.threadId}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    unitTestLogger("We received an indy credential offer")

    try {
      // Credential record already exists
      credentialRecord = await this.getByThreadAndConnectionId(credentialOfferMessage.threadId, connection?.id)

      // Assert
      credentialRecord.assertState(CredentialState.ProposalSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: credentialRecord.offerMessage,
        previousSentMessage: credentialRecord.proposalMessage,
      })

      credentialRecord.offerMessage = credentialOfferMessage

      credentialRecord.linkedAttachments = credentialOfferMessage.attachments?.filter(isLinkedAttachment)

      formatService.setMetaDataForOffer(credOffer, credentialRecord)

      await this.updateState(credentialRecord, CredentialState.OfferReceived)
    } catch {
      // No credential record exists with thread id

      unitTestLogger("No credential record found for this offer - create a new one")

      credentialRecord = new CredentialRecord({
        connectionId: connection?.id,
        threadId: credentialOfferMessage.id,
        offerMessage: credentialOfferMessage,
        credentialAttributes: credentialOfferMessage.credentialPreview.attributes,
        state: CredentialState.OfferReceived,
      })

      formatService.setMetaDataForOffer(credOffer, credentialRecord)

      // Assert
      this.connectionService.assertConnectionOrServiceDecorator(messageContext)

      // Save in repository
      await this.credentialRepository.save(credentialRecord)
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
   * Register the v2 handlers. These handlers supplement, ie are created in addition to, the existing\
   * v1 handlers.
   */
  public registerHandlers() {
    unitTestLogger("Registering V2 handlers...")
    unitTestLogger("  => V2ProposeCredentialHandler")

    this.dispatcher.registerHandler(
      new V2ProposeCredentialHandler(this, this.agentConfig, this.credentialResponseCoordinator)
    )

    unitTestLogger("  => V2OfferCredentialHandler")
    this.dispatcher.registerHandler(
      new V2OfferCredentialHandler(this, this.agentConfig, this.credentialResponseCoordinator, this.mediationRecipientService)
    )

    // Others to follow...

  }

  /**
 * Update the record to a new state and emit an state changed event. Also updates the record
 * in storage.
 *
 * @param credentialRecord The credential record to update the state for
 * @param newState The state to update to
 *
 */
  private async updateState(credentialRecord: CredentialRecord, newState: CredentialState) {
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
}