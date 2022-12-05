import type { AgentContext } from '../../../../agent'
import type { Query } from '../../../../storage/StorageService'
import type { MediationStateChangedEvent } from '../../RoutingEvents'
import type { MediationRecord } from '../../repository/MediationRecord'

import { Dispatcher } from '../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { MessageSender } from '../../../../agent/MessageSender'
import { AriesFrameworkError } from '../../../../error'
import { injectable } from '../../../../plugins'
import { JsonTransformer } from '../../../../utils'
import { ConnectionService } from '../../../connections/services/ConnectionService'
import { RecipientModuleConfig } from '../../RecipientModuleConfig'
import { RoutingEventTypes } from '../../RoutingEvents'
import { MediationState } from '../../models'
import { MediationRepository } from '../../repository/MediationRepository'

@injectable()
export class MediationRecipientSharedService {
  protected mediationRepository: MediationRepository
  protected eventEmitter: EventEmitter
  protected connectionService: ConnectionService
  protected messageSender: MessageSender
  protected dispatcher: Dispatcher
  protected recipientModuleConfig: RecipientModuleConfig

  public constructor(
    connectionService: ConnectionService,
    messageSender: MessageSender,
    mediatorRepository: MediationRepository,
    eventEmitter: EventEmitter,
    dispatcher: Dispatcher,
    recipientModuleConfig: RecipientModuleConfig
  ) {
    this.mediationRepository = mediatorRepository
    this.eventEmitter = eventEmitter
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.dispatcher = dispatcher
    this.recipientModuleConfig = recipientModuleConfig
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param MediationRecord The proof record to update the state for
   * @param newState The state to update to
   *
   */
  protected async updateState(agentContext: AgentContext, mediationRecord: MediationRecord, newState: MediationState) {
    const previousState = mediationRecord.state
    mediationRecord.state = newState
    await this.mediationRepository.update(agentContext, mediationRecord)

    this.emitStateChangedEvent(agentContext, mediationRecord, previousState)
    return mediationRecord
  }

  protected emitStateChangedEvent(
    agentContext: AgentContext,
    mediationRecord: MediationRecord,
    previousState: MediationState | null
  ) {
    const clonedMediationRecord = JsonTransformer.clone(mediationRecord)
    this.eventEmitter.emit<MediationStateChangedEvent>(agentContext, {
      type: RoutingEventTypes.MediationStateChanged,
      payload: {
        mediationRecord: clonedMediationRecord,
        previousState,
      },
    })
  }

  public async getById(agentContext: AgentContext, id: string): Promise<MediationRecord> {
    return this.mediationRepository.getById(agentContext, id)
  }

  public async findByConnectionId(agentContext: AgentContext, connectionId: string): Promise<MediationRecord | null> {
    return this.mediationRepository.findSingleByQuery(agentContext, { connectionId })
  }

  public async getMediators(agentContext: AgentContext): Promise<MediationRecord[]> {
    return this.mediationRepository.getAll(agentContext)
  }

  public async findAllMediatorsByQuery(
    agentContext: AgentContext,
    query: Query<MediationRecord>
  ): Promise<MediationRecord[]> {
    return await this.mediationRepository.findByQuery(agentContext, query)
  }

  public async findDefaultMediator(agentContext: AgentContext): Promise<MediationRecord | null> {
    return this.mediationRepository.findSingleByQuery(agentContext, { default: true })
  }

  public async discoverMediation(
    agentContext: AgentContext,
    mediatorId?: string
  ): Promise<MediationRecord | undefined> {
    // If mediatorId is passed, always use it (and error if it is not found)
    if (mediatorId) {
      return this.mediationRepository.getById(agentContext, mediatorId)
    }

    const defaultMediator = await this.findDefaultMediator(agentContext)
    if (defaultMediator) {
      if (defaultMediator.state !== MediationState.Granted) {
        throw new AriesFrameworkError(
          `Mediation State for ${defaultMediator.id} is not granted, but is set as default mediator!`
        )
      }

      return defaultMediator
    }
  }

  public async setDefaultMediator(agentContext: AgentContext, mediator: MediationRecord) {
    const mediationRecords = await this.mediationRepository.findByQuery(agentContext, { default: true })

    for (const record of mediationRecords) {
      record.setTag('default', false)
      await this.mediationRepository.update(agentContext, record)
    }

    // Set record coming in tag to true and then update.
    mediator.setTag('default', true)
    await this.mediationRepository.update(agentContext, mediator)
  }

  public async clearDefaultMediator(agentContext: AgentContext) {
    const mediationRecord = await this.findDefaultMediator(agentContext)

    if (mediationRecord) {
      mediationRecord.setTag('default', false)
      await this.mediationRepository.update(agentContext, mediationRecord)
    }
  }
}
