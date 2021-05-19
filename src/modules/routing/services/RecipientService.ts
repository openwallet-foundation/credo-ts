import type { Verkey } from 'indy-sdk'
import { createOutboundMessage } from '../../../agent/helpers'
import { AgentConfig } from '../../../agent/AgentConfig'
import { MessageSender } from '../../../agent/MessageSender'
import {
  KeylistUpdateMessage,
  KeylistUpdate,
  KeylistUpdateAction,
  ForwardMessage,
  MediationGrantMessage,
  MediationDenyMessage,
  MediationRequestMessage,
  KeylistUpdateResponseMessage,
} from '../messages'
import { Logger } from '../../../logger'
import { EventEmitter } from 'events'
import { Repository } from '../../../storage/Repository'
import { ConnectionInvitationMessage, ConnectionRecord } from '../../connections'
import { MediationEventType, MediationKeylistEvent, MediationStateChangedEvent } from './MediatorService'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { OutboundMessage } from '../../../types'
import { isIndyError } from '../../../utils/indyError'
import {
  assertConnection,
  createRecord,
  MediationRecord,
  MediationRecordProps,
  MediationRole,
  MediationState,
  MediationStorageProps,
} from '..'
import { Wallet } from '../../../wallet/Wallet'
import { AgentMessage } from '../../../agent/AgentMessage'

export enum MediationRecipientEventType {
  Granted = 'GRANTED',
  Denied = 'DENIED',
  KeylistUpdated = 'KEYLIST_UPDATED',
}

export class RecipientService extends EventEmitter {
  private agentConfig: AgentConfig
  private mediatorRepository: Repository<MediationRecord>
  private messageSender: MessageSender
  private defaultMediator?: MediationRecord
  private wallet: Wallet

  public constructor(
    agentConfig: AgentConfig,
    mediatorRepository: Repository<MediationRecord>,
    messageSender: MessageSender,
    wallet: Wallet
  ) {
    super()
    this.agentConfig = agentConfig
    this.mediatorRepository = mediatorRepository
    this.messageSender = messageSender
    this.wallet = wallet
  }

  public async createRequest(connection: ConnectionRecord): Promise<[MediationRecord, MediationRequestMessage]> {
    const mediationRecord = await createRecord(
      {
        connectionId: connection.id,
        role: MediationRole.Mediator,
        state: MediationState.Requested,
      },
      this.mediatorRepository
    )
    return [mediationRecord, new MediationRequestMessage({})]
  }

  public async processMediationGrant(messageContext: InboundMessageContext<MediationGrantMessage>) {
    const connection = assertConnection(
      messageContext.connection,
      'No connection associated with incoming mediation grant message'
    )
    // Mediation record must already exists to be updated to granted status
    const mediationRecord = await this.findByConnectionId(connection.id)
    if (!mediationRecord) {
      throw new Error(`No mediation has been requested for this connection id: ${connection.id}`)
    }
    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertConnection(connection.id)

    // Update record
    mediationRecord.endpoint = messageContext.message.endpoint
    mediationRecord.routingKeys = messageContext.message.routingKeys
    await this.updateState(mediationRecord, MediationState.Granted)

    return mediationRecord
  }

  public createKeylistQuery(
    filter?: Map<string, string>,
    paginateLimit?: number | undefined,
    paginateOffset?: number | undefined
  ) {
    //paginateLimit = paginateLimit ?? -1,
    //paginateOffset = paginateOffset ?? 0
    // TODO: Implement this
    //return new MediationKeyListQueryMessage()
    return new AgentMessage()
  }

  public async createKeylistUpdateMessage(verkey?: Verkey): Promise<KeylistUpdateMessage> {
    if (!verkey) {
      let did
      ;[did, verkey] = await this.wallet.createDid()
    }
    const keylistUpdateMessage = new KeylistUpdateMessage({
      updates: [
        new KeylistUpdate({
          action: KeylistUpdateAction.add,
          recipientKey: verkey,
        }),
      ],
    })
    return keylistUpdateMessage
  }

  public async processKeylistUpdateResults(messageContext: InboundMessageContext<KeylistUpdateResponseMessage>) {
    const connection = assertConnection(
      messageContext.connection,
      'No connection associated with incoming mediation keylistUpdateResults message'
    )
    const mediationRecord = await this.findByConnectionId(connection.id)
    if (!mediationRecord) {
      throw new Error(`mediation record for  ${connection.id} not found!`)
    }
    const keylist = messageContext.message.updated
    // TODO: update keylist in mediationRecord...
    // for ...
    // await this.mediatorRepository.update(mediationRecord)
    const event: MediationKeylistEvent = {
      mediationRecord,
      keylist,
    }
    this.emit(MediationEventType.KeylistUpdate, event)
  }

  public async processMediationDeny(messageContext: InboundMessageContext<MediationDenyMessage>) {
    const connection = assertConnection(
      messageContext.connection,
      'No connection associated with incoming mediation deny message'
    )

    // Mediation record already exists
    const mediationRecord = await this.findByConnectionId(connection.id)

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

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param MediationRecord The proof record to update the state for
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

  public async findById(mediatorId: string): Promise<MediationRecord> {
    const record = await this.mediatorRepository.find(mediatorId)
    return record
    // TODO - Handle errors?
  }

  public async findByConnectionId(id: string): Promise<MediationRecord | null> {
    const records = await this.mediatorRepository.findByQuery({ id })
    return records[0]
  }

  public async getMediators(): Promise<MediationRecord[] | null> {
    return await this.mediatorRepository.findAll()
  }

  public async getDefaultMediatorId(): Promise<string | undefined> {
    if (this.defaultMediator !== undefined) {
      return this.defaultMediator.id
    }
    const record = await this.getDefaultMediator()
    return record ? record.id : undefined
  }

  public async getDefaultMediator() {
    const results = await this.mediatorRepository.findByQuery({ default: 'true' })
    this.defaultMediator = results ? results[0] : this.defaultMediator // TODO: call setDefaultMediator
    return this.defaultMediator
  }

  public setDefaultMediator(mediator: MediationRecord) {
    // TODO: update default tag to be "true", set all other record default tags to "false"
    this.defaultMediator = mediator
  }

  public clearDefaultMediator() {
    // TODO: set all record default tags to "false"
    delete this.defaultMediator
  }
}

interface MediationRecipientProps {
  mediatorConnectionId: string
  mediatorPublicVerkey: Verkey
}
