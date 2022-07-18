import type { EncryptedMessage } from '../../../agent/didcomm/types'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { MediationStateChangedEvent } from '../RoutingEvents'
import type { ForwardMessageV2, KeylistUpdateMessageV2, MediationRequestMessageV2 } from '../messages'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { Wallet } from '../../../wallet/Wallet'
import { RoutingEventTypes } from '../RoutingEvents'
import {
  KeylistUpdateAction,
  KeylistUpdateResult,
  KeylistUpdated,
  KeylistUpdateResponseMessageV2,
  MediationGrantMessageV2,
} from '../messages'
import { MediationRole } from '../models/MediationRole'
import { MediationState } from '../models/MediationState'
import { MediatorRoutingRecord } from '../repository'
import { MediationRecord } from '../repository/MediationRecord'
import { MediationRepository } from '../repository/MediationRepository'
import { MediatorRoutingRepository } from '../repository/MediatorRoutingRepository'

@scoped(Lifecycle.ContainerScoped)
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
    messageContext: InboundMessageContext<ForwardMessageV2>
  ): Promise<{ mediationRecord: MediationRecord; encryptedMessage: EncryptedMessage }> {
    const { message } = messageContext

    const mediationRecord = await this.mediationRepository.getSingleByRecipientKey(message.body.next)

    // Assert mediation record is ready to be used
    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Mediator)

    return {
      encryptedMessage: message.getAttachmentDataAsJson(),
      mediationRecord,
    }
  }

  public async processKeylistUpdateRequest(messageContext: InboundMessageContext<KeylistUpdateMessageV2>) {
    const { message } = messageContext
    const keylist: KeylistUpdated[] = []

    if (!message.from) return
    const mediationRecord = await this.mediationRepository.getByDid(message.from)

    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Mediator)

    for (const update of message.body.updates) {
      const updated = new KeylistUpdated({
        action: update.action,
        recipientKey: update.recipientKey,
        result: KeylistUpdateResult.NoChange,
      })
      if (update.action === KeylistUpdateAction.add) {
        mediationRecord.addRecipientKey(update.recipientKey)
        updated.result = KeylistUpdateResult.Success

        keylist.push(updated)
      } else if (update.action === KeylistUpdateAction.remove) {
        const success = mediationRecord.removeRecipientKey(update.recipientKey)
        updated.result = success ? KeylistUpdateResult.Success : KeylistUpdateResult.NoChange
        keylist.push(updated)
      }
    }

    await this.mediationRepository.update(mediationRecord)

    return new KeylistUpdateResponseMessageV2({
      from: mediationRecord.did,
      body: { updated: keylist },
    })
  }

  public async createGrantMediationMessage(mediationRecord: MediationRecord) {
    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertRole(MediationRole.Mediator)

    await this.updateState(mediationRecord, MediationState.Granted)

    const message = new MediationGrantMessageV2({
      from: mediationRecord.did,
      body: {
        endpoint: this.agentConfig.endpoints[0],
        routingKeys: await this.getRoutingKeys(),
      },
    })

    return { mediationRecord, message }
  }

  public async processMediationRequest(messageContext: InboundMessageContext<MediationRequestMessageV2>) {
    if (!messageContext.message.from) return

    const mediationRecord = new MediationRecord({
      did: messageContext.message.from,
      role: MediationRole.Mediator,
      state: MediationState.Requested,
      threadId: messageContext.message.threadId || messageContext.message.id,
    })

    await this.mediationRepository.save(mediationRecord)
    this.eventEmitter.emit<MediationStateChangedEvent>({
      type: RoutingEventTypes.MediationStateChanged,
      payload: {
        mediationRecord,
        previousState: null,
      },
    })

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

    this.eventEmitter.emit<MediationStateChangedEvent>({
      type: RoutingEventTypes.MediationStateChanged,
      payload: {
        mediationRecord,
        previousState: previousState,
      },
    })
  }
}
