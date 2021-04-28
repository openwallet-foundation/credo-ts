import { Verkey } from 'indy-sdk'
import {
  MediationRecord,
  KeylistUpdateMessage,
  KeylistUpdateAction,
  ForwardMessage,
  KeylistUpdateResponseMessage,
  KeylistUpdateResult,
  KeylistUpdated,
  MediationRecordProps,
  MediationRole,
  MediationState,
  RequestMediationMessage,
  MediationDenyMessage,
  MediationGrantMessage,
  KeylistUpdate,
} from '..'
import { AgentConfig } from '../../../agent/AgentConfig'
import { MessageSender } from '../../../agent/MessageSender'
import { Logger } from '../../../logger'
import { EventEmitter } from 'events'
import { Repository } from '../../../storage/Repository'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { ConnectionRecord } from '../../connections'
import { BaseMessage } from '../../../agent/BaseMessage'
import { Wallet } from '../../../wallet/Wallet'
import { HandlerInboundMessage } from '../../../agent/Handler'
import { ForwardHandler } from '../handlers'
export interface RoutingTable {
  [recipientKey: string]: ConnectionRecord | undefined
}

export enum MediationEventType {
  Grant = 'GRANT',
  Deny = 'DENY',
  KeylistUpdate = 'KEYLIST_UPDATE',
}

export class MediationService extends EventEmitter {
  private messageSender: MessageSender
  private agentConfig: AgentConfig
  private mediationRepository: Repository<MediationRecord>
  private wallet: Wallet
  private routingKeys: Verkey[]
  public constructor(
    messageSender: MessageSender,
    mediationRepository: Repository<MediationRecord>,
    agentConfig: AgentConfig,
    wallet: Wallet,
    routingKeys?: Verkey[]
    ) {
      super()
      this.messageSender = messageSender
      this.mediationRepository = mediationRepository
      this.agentConfig = agentConfig
      this.wallet = wallet
      this.routingKeys = routingKeys ?? []
    }
    
    public async create({ state, role, connectionId, recipientKeys }: MediationRecordProps): Promise<MediationRecord> {
      const mediationRecord = new MediationRecord({
        state,
        role,
        connectionId,
        recipientKeys,
        tags: {
          state,
          role,
          connectionId,
        },
      })
      await this.mediationRepository.save(mediationRecord)
      return mediationRecord
    }
    
    private _assertConnection(connection: ConnectionRecord | undefined, msgType: BaseMessage): ConnectionRecord {
      if (!connection) throw Error('in bound connection is required for ${msgType.name}!')
      connection?.assertReady()
      return connection
    }
    
    processForwardMessage(messageContext: HandlerInboundMessage<ForwardHandler>) {
      throw new Error('Method not implemented.')
    }
    public async processKeylistUpdateRequest(messageContext: InboundMessageContext<KeylistUpdateMessage>) {
      const { message } = messageContext
      const connection = this._assertConnection(messageContext.connection, ForwardMessage)
      const updated = []
      const mediationRecord = await this.findRecipientByConnectionId(connection.id)
      if (!mediationRecord) {
        throw new Error(`mediation record for  ${connection.id} not found!`)
      }   
      for (const update of message.updates) {
        const update_ = new KeylistUpdated({
          action: update.action,
          recipientKey: update.recipientKey,
          result: KeylistUpdateResult.NoChange,
        })
        if (update.action === KeylistUpdateAction.add) {
          update_.result = await this.saveRoute(update.recipientKey, mediationRecord)
          updated.push(update_)
        } else if (update.action === KeylistUpdateAction.remove) {
          update_.result = await this.removeRoute(update.recipientKey, mediationRecord)
          updated.push(update_)
        }
      }
      // TODO: catch event in module and create/send message
      //const responseMessage = new KeylistUpdateResponseMessage({ updated })
      const event: MediationKeylistEvent = {
        mediationRecord,
        keylist: updated
      }
      this.emit(MediationEventType.KeylistUpdate, event)
    }
    
    public async saveRoute(recipientKey: Verkey, mediationRecord: MediationRecord | null): Promise<KeylistUpdateResult> {
      if (mediationRecord) {
        mediationRecord.recipientKeys.push(recipientKey)
        this.mediationRepository.update(mediationRecord)
        return KeylistUpdateResult.Success
      }
      return KeylistUpdateResult.ServerError
    }
    
    public async removeRoute(recipientKey: Verkey, mediationRecord: MediationRecord | null) {
      if (mediationRecord) {
        const index = mediationRecord.recipientKeys.indexOf(recipientKey, 0)
        if (index > -1) {
          mediationRecord.recipientKeys.splice(index, 1)
        }
        this.mediationRepository.update(mediationRecord)
        return KeylistUpdateResult.Success
      }
      return KeylistUpdateResult.ServerError
    }
    
    public async findRecipient(recipientKey: Verkey): Promise<string | null> {
      const records = await this.findAll()
      for (const record of records) {
        for (const key in record.recipientKeys) {
          if (recipientKey == key) {
            return record.connectionId
          }
        }
      }
      return null
    }
    
    public async findRecipientByConnectionId(connectionId: string): Promise<MediationRecord | null> {
      const records = await this.mediationRepository.findByQuery({ connectionId })
      return records[0]
    }
    
    public async prepareGrantMediationMessage(mediation: MediationRecord): Promise<MediationGrantMessage> {
      if(this.routingKeys.length === 0 ){
        const [did , verkey] = await this.wallet.createDid()
        this.routingKeys = [verkey]
      }
      mediation.state = MediationState.Granted
      await this.mediationRepository.update(mediation)
      return new MediationGrantMessage({
        endpoint: this.agentConfig.getEndpoint(),
        routing_keys: this.routingKeys,
      })
    }
    
    public async processMediationRequest(messageContext: InboundMessageContext<RequestMediationMessage>) {
      const { message } = messageContext
      // Assert connection
      const connection = this._assertConnection(messageContext.connection, ForwardMessage)
      
      const mediationRecord = await this.create({
        connectionId: connection.id,
        role: MediationRole.Mediator,
        state: MediationState.Init,
      })
      await this.updateState(mediationRecord, MediationState.Init)
      
      // Mediation can be either granted or denied. Someday, let business logic decide that
      this.prepareGrantMediationMessage(mediationRecord)
    }
    
    public async findByConnectionId(id: string): Promise<MediationRecord | null> {
      // TODO: Use findByQuery (connectionId as tag)
      const mediationRecords = await this.mediationRepository.findAll()
      
      for (const record of mediationRecords) {
        if (record.connectionId == id) {
          return record
        }
      }
      return null
    }
    
    public async findAll(): Promise<MediationRecord[]> {
      return await this.mediationRepository.findAll()
    }

  private async updateState(mediationRecord: MediationRecord, newState: MediationState) {
    const previousState = mediationRecord.state

    mediationRecord.state = newState

    await this.mediationRepository.update(mediationRecord)

    const event: MediationStateChangedEvent = {
      mediationRecord,
      previousState: previousState,
    }

    this.emit(MediationEventType.StateChanged, event)
  }
}

export enum MediationEventType {
  StateChanged = 'stateChanged',
}

export interface MediationStateChangedEvent {
  mediationRecord: MediationRecord
  previousState: MediationState
}

export interface MediationGrantedEvent {
  connectionRecord: ConnectionRecord
  endpoint: string
  routingKeys: Verkey[]
}

export interface MediationKeylistEvent {
  mediationRecord: MediationRecord
  keylist: KeylistUpdated[]
}