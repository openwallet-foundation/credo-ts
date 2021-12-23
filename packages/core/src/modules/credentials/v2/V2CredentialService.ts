import { AgentMessage, AgentConfig, MessageSender, CredentialState, CredentialStateChangedEvent, CredentialEventTypes } from '@aries-framework/core'
import { CredentialService } from '../CredentialService'
import { ProposeCredentialOptions } from './interfaces'
import { CredentialRecord, CredentialRepository } from '../repository'
import { EventEmitter } from '../../../agent/EventEmitter'
import { CredentialRecordType } from './CredentialExchangeRecord'
import { CredentialFormatService } from './formats/CredentialFormatService'
import { unitTestLogger, LogLevel } from '../../../logger'
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


@scoped(Lifecycle.ContainerScoped)
export class V2CredentialService extends CredentialService {
  createOfferAsResponse(credentialRecord: CredentialRecord, arg1: { credentialDefinitionId: any; preview: any }): { message: any } | PromiseLike<{ message: any }> {
    throw new Error("Method not implemented.")
  }


  private credentialService: V1LegacyCredentialService // Temporary while v1 constructor needs this
  private connectionService: ConnectionService
  private credentialRepository: CredentialRepository
  private eventEmitter: EventEmitter
  private agentConfig: AgentConfig
  private credentialResponseCoordinator: CredentialResponseCoordinator
  private dispatcher: Dispatcher
  private logger: Logger

  constructor(connectionService: ConnectionService,
    credentialService: V1LegacyCredentialService,
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    msgSender: MessageSender,
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    credentialResponseCoordinator: CredentialResponseCoordinator
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
  }

  public getVersion(): CredentialProtocolVersion {
    return CredentialProtocolVersion.V2_0
  }

  public getFormatService(_credentialRecordType: CredentialRecordType): CredentialFormatService {

    const serviceFormatMap = {
      [CredentialRecordType.INDY]: IndyCredentialFormatService,
      [CredentialRecordType.W3C]: JsonLdCredentialFormatService,
    }
    return new serviceFormatMap[_credentialRecordType](this.credentialRepository, this.eventEmitter)
  }

  public async createProposal(proposal: ProposeCredentialOptions): Promise<{ credentialRecord: CredentialRecord, message: AgentMessage }> {
    // should handle all formats in proposal.credentialFormats by querying and calling
    // its corresponding handler classes.
    const connection = await this.connectionService.getById(proposal.connectionId)

    unitTestLogger(">> IN SERVICE V2")
    const credentialRecordType = proposal.credentialFormats.indy ? CredentialRecordType.INDY : CredentialRecordType.W3C

    unitTestLogger("Get the Format Service and Create Proposal Message")


    const formatService: CredentialFormatService = this.getFormatService(credentialRecordType)

    const credentialMessageBuilder = new CredentialMessageBuilder()
    const { message, credentialRecord } = credentialMessageBuilder.createProposal(formatService, proposal, connection.threadId)

    unitTestLogger("Save meta data and emit state change event")
    await formatService.setMetaDataAndEmitEvent(proposal, credentialRecord)

    return { credentialRecord, message }
  }

  public async processProposal(messageContext: HandlerInboundMessage<V2ProposeCredentialHandler>): Promise<CredentialRecord> {
    let credentialRecord: CredentialRecord
    const { message: proposalMessage, connection } = messageContext


    this.logger.debug(`Processing credential proposal with id ${proposalMessage.id}`)

    // get the format service here to format correctly...

    try {
      // Credential record already exists
      credentialRecord = await this.getByThreadAndConnectionId(proposalMessage.threadId, connection?.id)
      // Assert

      // MJR-TODO rework this for v2

      credentialRecord.assertState(CredentialState.OfferSent)
      this.connectionService.assertConnectionOrServiceDecorator(messageContext, {
        previousReceivedMessage: credentialRecord.proposalMessage,
        previousSentMessage: credentialRecord.offerMessage,
      })

      //   // Update record
      //   credentialRecord.proposalMessage = proposalMessage
      //   await this.updateState(credentialRecord, CredentialState.ProposalReceived)
    } catch {
      //   // No credential record exists with thread id

      console.log("TEST-DEBUG No credential record exists")
      // get the format service based on the preview id

      const credentialRecordType = proposalMessage.filtersAttach.tempId === 'indy' ? CredentialRecordType.INDY : CredentialRecordType.W3C
      const formatService: CredentialFormatService = this.getFormatService(credentialRecordType)

      const credentialMessageBuilder = new CredentialMessageBuilder()
      credentialRecord = credentialMessageBuilder.acceptProposal(formatService, proposalMessage, connection?.id)

      // Save record and emit event

      this.connectionService.assertConnectionOrServiceDecorator(messageContext)
      await this.credentialRepository.save(credentialRecord)
      
      let options: ProposeCredentialOptions
      if (proposalMessage.filtersAttach.data.base64) {
        options = JsonEncoder.fromBase64(proposalMessage.filtersAttach.data.base64)
        formatService.setMetaDataAndEmitEvent(options, credentialRecord)
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

  public registerHandlers() {
    console.log("TEST-DEBUG...REGISTER V2 HANDLERS")
    this.dispatcher.registerHandler(
      new V2ProposeCredentialHandler(this, this.agentConfig, this.credentialResponseCoordinator)
    )

    // this.dispatcher.registerHandler(
    //   new ProposeCredentialHandler(this.credentialService, this.agentConfig, this.credentialResponseCoordinator)
    // )
  }
}