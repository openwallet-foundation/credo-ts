import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { EncryptedMessage } from '../../../types'
import type { MediationStateChangedEvent } from '../RoutingEvents'
import type { ForwardMessage, KeylistUpdateMessage, MediationRequestMessage } from '../messages'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { AriesFrameworkError } from '../../../error'
import { inject, injectable } from '../../../plugins'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { Wallet } from '../../../wallet/Wallet'
import { didKeyToVerkey } from '../../dids/helpers'
import { RoutingEventTypes } from '../RoutingEvents'
import {
  KeylistUpdateAction,
  KeylistUpdateResult,
  KeylistUpdated,
  MediationGrantMessage,
  KeylistUpdateResponseMessage,
} from '../messages'
import { MediationRole } from '../models/MediationRole'
import { MediationState } from '../models/MediationState'
import { MediatorRoutingRecord } from '../repository'
import { MediationRecord } from '../repository/MediationRecord'
import { MediationRepository } from '../repository/MediationRepository'
import { MediatorRoutingRepository } from '../repository/MediatorRoutingRepository'

@injectable()
export class MediatorService {
  private agentConfig: AgentConfig
  private mediationRepository: MediationRepository
  private mediatorRoutingRepository: MediatorRoutingRepository
  private wallet: Wallet
  private eventEmitter: EventEmitter
  private _mediatorRoutingRecord?: MediatorRoutingRecord

  public constructor(
    mediationRepository: MediationRepository,
    mediatorRoutingRepository: MediatorRoutingRepository,
    agentConfig: AgentConfig,
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    eventEmitter: EventEmitter
  ) {
    this.mediationRepository = mediationRepository
    this.mediatorRoutingRepository = mediatorRoutingRepository
    this.agentConfig = agentConfig
    this.wallet = wallet
    this.eventEmitter = eventEmitter
  }

  private async getRoutingKeys() {
    this.agentConfig.logger.debug('Retrieving mediator routing keys')
    // If the routing record is not loaded yet, retrieve it from storage
    if (!this._mediatorRoutingRecord) {
      this.agentConfig.logger.debug('Mediator routing record not loaded yet, retrieving from storage')
      let routingRecord = await this.mediatorRoutingRepository.findById(
        this.mediatorRoutingRepository.MEDIATOR_ROUTING_RECORD_ID
      )

      // If we don't have a routing record yet, create it
      if (!routingRecord) {
        this.agentConfig.logger.debug('Mediator routing record does not exist yet, creating routing keys and record')
        const { verkey } = await this.wallet.createDid()

        routingRecord = new MediatorRoutingRecord({
          id: this.mediatorRoutingRepository.MEDIATOR_ROUTING_RECORD_ID,
          routingKeys: [verkey],
        })

        await this.mediatorRoutingRepository.save(routingRecord)
      }

      this._mediatorRoutingRecord = routingRecord
    }

    // Return the routing keys
    this.agentConfig.logger.debug(`Returning mediator routing keys ${this._mediatorRoutingRecord.routingKeys}`)
    return this._mediatorRoutingRecord.routingKeys
  }

  public async processForwardMessage(
    messageContext: InboundMessageContext<ForwardMessage>
  ): Promise<{ mediationRecord: MediationRecord; encryptedMessage: EncryptedMessage }> {
    const { message } = messageContext

    // TODO: update to class-validator validation
    if (!message.to) {
      throw new AriesFrameworkError('Invalid Message: Missing required attribute "to"')
    }

    const mediationRecord = await this.mediationRepository.getSingleByRecipientKey(message.to)

    // Assert mediation record is ready to be used
    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Mediator)

    return {
      encryptedMessage: message.message,
      mediationRecord,
    }
  }

  public async processKeylistUpdateRequest(messageContext: InboundMessageContext<KeylistUpdateMessage>) {
    // Assert Ready connection
    const connection = messageContext.assertReadyConnection()

    const { message } = messageContext
    const keylist: KeylistUpdated[] = []

    const mediationRecord = await this.mediationRepository.getByConnectionId(connection.id)

    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Mediator)

    for (const update of message.updates) {
      const updated = new KeylistUpdated({
        action: update.action,
        recipientKey: update.recipientKey,
        result: KeylistUpdateResult.NoChange,
      })

      // According to RFC 0211 key should be a did key, but base58 encoded verkey was used before
      // RFC was accepted. This converts the key to a public key base58 it it is a did key.
      const publicKeyBase58 = didKeyToVerkey(update.recipientKey)

      if (update.action === KeylistUpdateAction.add) {
        mediationRecord.addRecipientKey(publicKeyBase58)
        updated.result = KeylistUpdateResult.Success

        keylist.push(updated)
      } else if (update.action === KeylistUpdateAction.remove) {
        const success = mediationRecord.removeRecipientKey(publicKeyBase58)
        updated.result = success ? KeylistUpdateResult.Success : KeylistUpdateResult.NoChange
        keylist.push(updated)
      }
    }

    await this.mediationRepository.update(mediationRecord)

    return new KeylistUpdateResponseMessage({ keylist, threadId: message.threadId })
  }

  public async createGrantMediationMessage(mediationRecord: MediationRecord) {
    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertRole(MediationRole.Mediator)

    await this.updateState(mediationRecord, MediationState.Granted)

    const message = new MediationGrantMessage({
      endpoint: this.agentConfig.endpoints[0],
      routingKeys: await this.getRoutingKeys(),
      threadId: mediationRecord.threadId,
    })

    return { mediationRecord, message }
  }

  public async processMediationRequest(messageContext: InboundMessageContext<MediationRequestMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    const mediationRecord = new MediationRecord({
      connectionId: connection.id,
      role: MediationRole.Mediator,
      state: MediationState.Requested,
      threadId: messageContext.message.threadId,
    })

    await this.mediationRepository.save(mediationRecord)
    this.emitStateChangedEvent(mediationRecord, null)

    return mediationRecord
  }

  public async findById(mediatorRecordId: string): Promise<MediationRecord | null> {
    return this.mediationRepository.findById(mediatorRecordId)
  }

  public async getById(mediatorRecordId: string): Promise<MediationRecord> {
    return this.mediationRepository.getById(mediatorRecordId)
  }

  public async getAll(): Promise<MediationRecord[]> {
    return await this.mediationRepository.getAll()
  }

  private async updateState(mediationRecord: MediationRecord, newState: MediationState) {
    const previousState = mediationRecord.state

    mediationRecord.state = newState

    await this.mediationRepository.update(mediationRecord)

    this.emitStateChangedEvent(mediationRecord, previousState)
  }

  private emitStateChangedEvent(mediationRecord: MediationRecord, previousState: MediationState | null) {
    const clonedMediationRecord = JsonTransformer.clone(mediationRecord)
    this.eventEmitter.emit<MediationStateChangedEvent>({
      type: RoutingEventTypes.MediationStateChanged,
      payload: {
        mediationRecord: clonedMediationRecord,
        previousState,
      },
    })
  }
}
