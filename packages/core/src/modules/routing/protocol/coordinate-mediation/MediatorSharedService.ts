import type { AgentContext } from '../../../../agent'
import type { Query } from '../../../../storage/StorageService'
import type { MediationStateChangedEvent } from '../../RoutingEvents'
import type { MediationState } from '../../models/MediationState'
import type { MediationRecord } from '../../repository/MediationRecord'

import { Dispatcher } from '../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { MessageSender } from '../../../../agent/MessageSender'
import { InjectionSymbols } from '../../../../constants'
import { AriesFrameworkError } from '../../../../error/AriesFrameworkError'
import { Logger } from '../../../../logger'
import { injectable, inject } from '../../../../plugins'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { ConnectionService } from '../../../connections/services/ConnectionService'
import { MediatorModuleConfig } from '../../MediatorModuleConfig'
import { RoutingEventTypes } from '../../RoutingEvents'
import { MediatorRoutingRecord } from '../../repository'
import { MediationRepository } from '../../repository/MediationRepository'
import { MediatorRoutingRepository } from '../../repository/MediatorRoutingRepository'

@injectable()
export class MediatorSharedService {
  protected logger: Logger
  protected mediationRepository: MediationRepository
  protected connectionService: ConnectionService
  protected mediatorRoutingRepository: MediatorRoutingRepository
  protected eventEmitter: EventEmitter
  protected messageSender: MessageSender
  protected dispatcher: Dispatcher
  protected mediatorModuleConfig: MediatorModuleConfig

  protected _mediatorRoutingRecord?: MediatorRoutingRecord

  public constructor(
    mediationRepository: MediationRepository,
    connectionService: ConnectionService,
    mediatorRoutingRepository: MediatorRoutingRepository,
    eventEmitter: EventEmitter,
    @inject(InjectionSymbols.Logger) logger: Logger,
    messageSender: MessageSender,
    dispatcher: Dispatcher,
    mediatorModuleConfig: MediatorModuleConfig
  ) {
    this.mediationRepository = mediationRepository
    this.connectionService = connectionService
    this.mediatorRoutingRepository = mediatorRoutingRepository
    this.eventEmitter = eventEmitter
    this.logger = logger
    this.messageSender = messageSender
    this.dispatcher = dispatcher
    this.mediatorModuleConfig = mediatorModuleConfig
  }

  protected async getRoutingKeys(agentContext: AgentContext) {
    const mediatorRoutingRecord = await this.findMediatorRoutingRecord(agentContext)

    if (mediatorRoutingRecord) {
      // Return the routing keys
      this.logger.debug(`Returning mediator routing keys ${mediatorRoutingRecord.routingKeys}`)
      return mediatorRoutingRecord.routingKeys
    }
    throw new AriesFrameworkError(`Mediator has not been initialized yet.`)
  }

  public async findById(agentContext: AgentContext, mediatorRecordId: string): Promise<MediationRecord | null> {
    return this.mediationRepository.findById(agentContext, mediatorRecordId)
  }

  public async getById(agentContext: AgentContext, mediatorRecordId: string): Promise<MediationRecord> {
    return this.mediationRepository.getById(agentContext, mediatorRecordId)
  }

  public async getAll(agentContext: AgentContext): Promise<MediationRecord[]> {
    return await this.mediationRepository.getAll(agentContext)
  }

  public async findMediatorRoutingRecord(agentContext: AgentContext): Promise<MediatorRoutingRecord | null> {
    const routingRecord = await this.mediatorRoutingRepository.findById(
      agentContext,
      this.mediatorRoutingRepository.MEDIATOR_ROUTING_RECORD_ID
    )

    return routingRecord
  }

  public async createMediatorRoutingRecord(agentContext: AgentContext): Promise<MediatorRoutingRecord | null> {
    const { verkey } = await agentContext.wallet.createDid()

    const routingRecord = new MediatorRoutingRecord({
      id: this.mediatorRoutingRepository.MEDIATOR_ROUTING_RECORD_ID,
      routingKeys: [verkey],
    })

    await this.mediatorRoutingRepository.save(agentContext, routingRecord)

    return routingRecord
  }

  public async findAllByQuery(agentContext: AgentContext, query: Query<MediationRecord>): Promise<MediationRecord[]> {
    return await this.mediationRepository.findByQuery(agentContext, query)
  }

  protected async updateState(agentContext: AgentContext, mediationRecord: MediationRecord, newState: MediationState) {
    const previousState = mediationRecord.state

    mediationRecord.state = newState

    await this.mediationRepository.update(agentContext, mediationRecord)

    this.emitStateChangedEvent(agentContext, mediationRecord, previousState)
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
}
