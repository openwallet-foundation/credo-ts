import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { EncryptedMessage } from '../../../types'
import type { MediationStateChangedEvent } from '../RoutingEvents'
import type { ForwardMessage, KeylistUpdateMessage, MediationRequestMessage } from '../messages'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { AriesFrameworkError } from '../../../error'
import { Wallet } from '../../../wallet/Wallet'
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
    messageContext: InboundMessageContext<ForwardMessage>
  ): Promise<{ mediationRecord: MediationRecord; packedMessage: EncryptedMessage }> {
    const { message } = messageContext

    // TODO: update to class-validator validation
    if (!message.to) {
      throw new AriesFrameworkError('Invalid Message: Missing required attribute "to"')
    }

    const mediationRecord = await this.mediationRepository.getSingleByRecipientKey(message.to)

    // Assert mediation record is ready to be used
    mediationRecord.assertReady()

    return {
      packedMessage: message.message,
      mediationRecord,
    }
  }

  public async processKeylistUpdateRequest(messageContext: InboundMessageContext<KeylistUpdateMessage>) {
    // Assert Ready connection
    const connection = messageContext.assertReadyConnection()

    const { message } = messageContext
    const keylist: KeylistUpdated[] = []

    const mediationRecord = await this.mediationRepository.getByConnectionId(connection.id)

    for (const update of message.updates) {
      const updated = new KeylistUpdated({
        action: update.action,
        recipientKey: update.recipientKey,
        result: KeylistUpdateResult.NoChange,
      })
      if (update.action === KeylistUpdateAction.add) {
        updated.result = await this.saveRoute(update.recipientKey, mediationRecord)
        keylist.push(updated)
      } else if (update.action === KeylistUpdateAction.remove) {
        updated.result = await this.removeRoute(update.recipientKey, mediationRecord)
        keylist.push(updated)
      }
    }

    return new KeylistUpdateResponseMessage({ keylist, threadId: message.threadId })
  }

  public async saveRoute(recipientKey: string, mediationRecord: MediationRecord) {
    try {
      mediationRecord.recipientKeys.push(recipientKey)
      this.mediationRepository.update(mediationRecord)
      return KeylistUpdateResult.Success
    } catch (error) {
      this.agentConfig.logger.error(
        `Error processing keylist update action for verkey '${recipientKey}' and mediation record '${mediationRecord.id}'`
      )
      return KeylistUpdateResult.ServerError
    }
  }

  public async removeRoute(recipientKey: string, mediationRecord: MediationRecord) {
    try {
      const index = mediationRecord.recipientKeys.indexOf(recipientKey, 0)
      if (index > -1) {
        mediationRecord.recipientKeys.splice(index, 1)

        await this.mediationRepository.update(mediationRecord)
        return KeylistUpdateResult.Success
      }

      return KeylistUpdateResult.ServerError
    } catch (error) {
      this.agentConfig.logger.error(
        `Error processing keylist remove action for verkey '${recipientKey}' and mediation record '${mediationRecord.id}'`
      )
      return KeylistUpdateResult.ServerError
    }
  }

  public async createGrantMediationMessage(mediationRecord: MediationRecord) {
    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertRole(MediationRole.Mediator)

    mediationRecord.state = MediationState.Granted
    await this.mediationRepository.update(mediationRecord)

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
