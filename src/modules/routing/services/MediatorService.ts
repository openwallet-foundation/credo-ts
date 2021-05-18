import { Lifecycle, scoped } from 'tsyringe'
import { Verkey } from 'indy-sdk'

import {
  MediationRecord,
  KeylistUpdateMessage,
  KeylistUpdateAction,
  ForwardMessage,
  KeylistUpdateResult,
  KeylistUpdated,
  MediationRole,
  MediationState,
  MediationGrantMessage,
  MediationRequestMessage,
  createRecord,
} from '..'

import { AgentConfig } from '../../../agent/AgentConfig'

import { Repository } from '../../../storage/Repository'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { ConnectionRecord } from '../../connections'
import { BaseMessage } from '../../../agent/BaseMessage'
import { Wallet } from '../../../wallet/Wallet'
import { HandlerInboundMessage } from '../../../agent/Handler'
import { ForwardHandler } from '../handlers'
import { uuid } from '../../../utils/uuid'
import { MediationKeylistEvent, MediationStateChangedEvent, RoutingEventTypes } from '../RoutingEvents'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'

export interface RoutingTable {
  [recipientKey: string]: ConnectionRecord | undefined
}

export enum MediationEventType {
  Grant = 'GRANT',
  Deny = 'DENY',
  KeylistUpdate = 'KEYLIST_UPDATE',
}

@scoped(Lifecycle.ContainerScoped)
export class MediatorService {
  private agentConfig: AgentConfig
  private mediationRepository: Repository<MediationRecord>
  private wallet: Wallet
  private routingKeys: Verkey[]
  private eventEmitter: EventEmitter

  public constructor(
    mediationRepository: Repository<MediationRecord>,
    agentConfig: AgentConfig,
    wallet: Wallet,
    eventEmitter: EventEmitter,
    routingKeys?: Verkey[]
  ) {
    this.mediationRepository = mediationRepository
    this.agentConfig = agentConfig
    this.wallet = wallet
    this.eventEmitter = eventEmitter
    this.routingKeys = routingKeys ?? []
  }

  private _assertConnection(connection: ConnectionRecord | undefined, msgType: BaseMessage): ConnectionRecord {
    if (!connection) throw new AriesFrameworkError(`inbound connection is required for ${msgType.constructor.name}!`)
    connection.assertReady()
    return connection
  }

  public async processForwardMessage(messageContext: HandlerInboundMessage<ForwardHandler>) {
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
    this.eventEmitter.emit<MediationKeylistEvent>({
      type: RoutingEventTypes.MediationKeylist,
      payload: {
        mediationRecord,
        keylist: updated,
      },
    })
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
    const records = await this.getAll()
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

  public async createGrantMediationMessage(mediation: MediationRecord): Promise<MediationGrantMessage> {
    if (this.routingKeys.length === 0) {
      const [did, verkey] = await this.wallet.createDid()
      this.routingKeys = [verkey]
    }
    mediation.state = MediationState.Granted
    await this.mediationRepository.update(mediation)
    return new MediationGrantMessage({
      id: uuid(), // HELP: should this be the thread id from the request?
      endpoint: this.agentConfig.getEndpoint(),
      routingKeys: this.routingKeys,
    })
  }

  public async processMediationRequest(messageContext: InboundMessageContext<MediationRequestMessage>) {
    const { message } = messageContext
    // Assert connection
    const connection = this._assertConnection(messageContext.connection, ForwardMessage)

    const mediationRecord = await createRecord(
      {
        connectionId: connection.id,
        role: MediationRole.Mediator,
        state: MediationState.Init,
      },
      this.mediationRepository
    )
    await this.updateState(mediationRecord, MediationState.Init)

    // Mediation can be either granted or denied. Someday, let business logic decide that
    this.createGrantMediationMessage(mediationRecord)
  }

  public async findByConnectionId(id: string): Promise<MediationRecord | null> {
    // TODO: Use findByQuery (connectionId as tag)
    const mediationRecords = await this.mediationRepository.getAll()

    for (const record of mediationRecords) {
      if (record.connectionId == id) {
        return record
      }
    }
    return null
  }

  public async getAll(): Promise<MediationRecord[]> {
    return await this.mediationRepository.getAll()
  }

  private async updateState(mediationRecord: MediationRecord, newState: MediationState) {
    const previousState = mediationRecord.state

    mediationRecord.state = newState

    await this.mediationRepository.update(mediationRecord)

    this.eventEmitter.emit<MediationStateChangedEvent>({
      type: RoutingEventTypes.MediationStateChanged,
      payload: {
        mediationRecord,
        previousState: previousState,
      },
    })
  }
}
