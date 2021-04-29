import type { Verkey } from 'indy-sdk'
import { createOutboundMessage } from '../../../agent/helpers'
import { AgentConfig } from '../../../agent/AgentConfig'
import { MessageSender } from '../../../agent/MessageSender'
import {
  KeylistUpdateMessage,
  KeylistUpdate,
  KeylistUpdateAction,
  ForwardMessage,
  MediationGrantedMessage,
  MediationDeniedMessage,
  MediationRequestMessage,
} from '../messages'
import { Logger } from '../../../logger'
import { EventEmitter } from 'events'
import { Repository } from '../../../storage/Repository'
import { ConnectionInvitationMessage, ConnectionRecord } from '../../connections'
import { MediationEventType, MediationStateChangedEvent, RoutingTable } from './MediationService'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { OutboundMessage } from '../../../types'
import { isIndyError } from '../../../utils/indyError'
import { DefaultMediationRecord, MediationRecord, MediationRecordProps, MediationRole, MediationState } from '..'

export enum MediationRecipientEventType {
  Granted = 'GRANTED',
  Denied = 'DENIED',
  KeylistUpdated = 'KEYLIST_UPDATED',
}

export class MediationRecipientService extends EventEmitter {
  // TODO: Review this, placeholder
  private logger: Logger
  private agentConfig: AgentConfig
  private mediatorRepository: Repository<MediationRecord>
  private messageSender: MessageSender
  private defaultMediator?: DefaultMediationRecord

  // TODO: Review this, placeholder
  public constructor(
    agentConfig: AgentConfig,
    mediatorRepository: Repository<MediationRecord>,
    messageSender: MessageSender
  ) {
    super()
    this.agentConfig = agentConfig
    this.logger = agentConfig.logger
    this.mediatorRepository = mediatorRepository
    this.messageSender = messageSender
    this.provision()
  }
  private provision() {
    // Using agent config, establish connection with mediator.
    // Send mediation request.
    // Upon granting, set as default mediator.
  }

  public async requestMediation(connection: ConnectionRecord) {
    await this.create({
      connectionId: connection.id,
      role: MediationRole.Recipient,
      state: MediationState.Requested,
    })

    const mediationRequestMessage = new MediationRequestMessage({})

    return createOutboundMessage(connection, mediationRequestMessage)
  }

  public async createRoute(verkey: Verkey) {
    this.logger.debug(`Registering route for verkey '${verkey}' at mediator`)

    if (!this.agentConfig.inboundConnection) {
      this.logger.debug(`There is no mediator. Creating route for verkey '${verkey}' skipped.`)
    } else {
      const routingConnection = this.agentConfig.inboundConnection.connection

      const keylistUpdateMessage = new KeylistUpdateMessage({
        updates: [
          new KeylistUpdate({
            action: KeylistUpdateAction.add,
            recipientKey: verkey,
          }),
        ],
      })

      const outboundMessage = createOutboundMessage(routingConnection, keylistUpdateMessage)
      await this.messageSender.sendMessage(outboundMessage)
    }
  }

  public async processMediationGrant(messageContext: InboundMessageContext<MediationGrantMessage>) {
    const connection = messageContext.connection

    // Assert connection
    connection?.assertReady()
    if (!connection) {
      throw new Error('No connection associated with incoming mediation grant message')
    }

    // Mediation record already exists
    const mediationRecord = await this.findByConnectionId(messageContext.connection?.id || '')

    if (!mediationRecord) {
      throw new Error(`No mediation has been requested for this connection id: ${connection.id}`)
    }

    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertConnection(connection.id)

    // Update record
    mediationRecord.endpoint = messageContext.message.endpoint
    mediationRecord.routingKeys = messageContext.message.routing_keys
    await this.updateState(mediationRecord, MediationState.Granted)

    return mediationRecord
  }

  public async processMediationDeny(messageContext: InboundMessageContext<MediationDenyMessage>) {
    const connection = messageContext.connection

    // Assert connection
    connection?.assertReady()
    if (!connection) {
      throw new Error('No connection associated with incoming mediation deny message')
    }

    // Mediation record already exists
    const mediationRecord = await this.findByConnectionId(messageContext.connection?.id || '')

    if (!mediationRecord) {
      throw new Error(`No mediation has been requested for this connection id: ${connection.id}`)
    }

    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertConnection(connection.id)

    // Update record
    await this.updateState(mediationRecord, MediationState.Denied)

    return mediationRecord
  }

  public async create(options: MediationRecordProps): Promise<MediationRecord> {
    const mediationRecord = new MediationRecord(options)
    await this.mediatorRepository.save(mediationRecord)
    return mediationRecord
  }

    /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param proofRecord The proof record to update the state for
   * @param newState The state to update to
   *
   */
     private async updateState(mediationRecord: MediationRecord, newState: MediationState) {
      const previousState = mediationRecord.state
  
      mediationRecord.state = newState
  
      await this.mediatorRepository.update(mediationRecord)
  
      const event: MediationStateChangedEvent = {
        mediationRecord,
        previousState: previousState,
      }
  
      this.emit(MediationEventType.StateChanged, event)
    }

  // // TODO: Review this, placeholder
  // public async requestMediation(connectionRecord: ConnectionRecord): Promise<MediationRecipientRecord> {
  //   // Ensure that the connection is complete (check state) (validate, assert state)
  //   // Send mediation request message
  //   // create mediation recipient record and then return it.
  //   return new MediationRecipientRecord();
  // }

  // recieve and handle the "granted" response from the mediator
  public handleGranted() {
    this.emit(MediationRecipientEventType.Granted)
  }

  // recieve and handle the "denied" response from the mediator.
  public handleDenied() {
    this.emit(MediationRecipientEventType.Denied)
  }

  public async findById(mediatorId: string): Promise< MediationRecord> {
      const connection = await this.mediatorRepository.find(mediatorId)
      return connection
      // TODO - Handle errors
  }

  public async findByConnectionId(id: string): Promise<MediationRecord | null> {
    // TODO: Use findByQuery (connectionId as tag)
    const mediationRecords = await this.mediatorRepository.findAll()

    for (const record of mediationRecords) {
      if (record.connectionId == id) {
        return record
      }
    }
    return null
  }

  public async getMediators(): Promise<MediationRecord[] | null> {
    return await this.mediatorRepository.findAll()
  }

  // Adding empty methods
  public getDefaultMediatorId(): string | undefined {
    if (this.defaultMediator !== undefined) {
      return this.defaultMediator.mediationId
    }
    return undefined
  }

  public getDefaultMediator() {
    return this.defaultMediator
  }

  public setDefaultMediator(mediator: DefaultMediationRecord) {
    this.defaultMediator = mediator
  }

  public clearDefaultMediator() {
    delete this.defaultMediator
  }

  public prepareKeylistUpdateMessage(
    action: KeylistUpdateAction,
    recipientKey: Verkey,
    message?: KeylistUpdateMessage
  ) {
    // The default mediator
  }

  public storeKeylistUpdateResults() {
    // Method here
  }
  public prepareKeylistQuery(filter: Map<string, string>, paginateLimit = -1, paginateOffset = 0) {
    // Method here
  }

  public prepareRequest(connectionId: string):OutboundMessage {
    // The default mediator
  }

  public reqeustGranted(mediationRecord: MediationRecord, grant: MediationGrantedMessage) {
    // The default mediator
  }

  public reqeustDenied(mediationRecord: MediationRecord, deny: MediationDeniedMessage) {
    // The default mediator
  }

  // Taken from Provisioning Service
  public async registerMediator(connectionRecord: ConnectionRecord): Promise<MediationRecord> {
    const mediationRecord = new MediationRecord({
      connectionRecord.id
    })
    await this.mediatorRepository.save(mediationRecord)
    return mediationRecord
  }

  //  Taken from ConsumerRoutingService
  public async sendAddKeylistUpdate(verkey: Verkey) {
    this.logger.debug(`Registering route for verkey '${verkey}' at mediator`)

    if (!this.agentConfig.inboundConnection) {
      this.logger.debug(`There is no mediator. Creating route for verkey '${verkey}' skipped.`)
    } else {
      const routingConnection = this.agentConfig.inboundConnection.connection

      const keylistUpdateMessage = new KeylistUpdateMessage({
        updates: [
          new KeylistUpdate({
            action: KeylistUpdateAction.add,
            recipientKey: verkey,
          }),
        ],
      })

      const outboundMessage = createOutboundMessage(routingConnection, keylistUpdateMessage)
      await this.messageSender.sendMessage(outboundMessage)
    }
  }
}

interface MediationRecipientProps {
  mediatorConnectionId: string
  mediatorPublicVerkey: Verkey
}
