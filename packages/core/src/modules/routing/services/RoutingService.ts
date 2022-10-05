import type { Routing } from '../../connections'
import type { GetRoutingOptions } from '../../routing'
import type { MediationRecord } from '../repository'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { AriesFrameworkError } from '../../../error'
import { inject, injectable } from '../../../plugins'
import { Wallet } from '../../../wallet'
import { MediationState } from '../models'
import { MediationRepository } from '../repository'

import { MediationRecipientService } from './MediationRecipientService'

@injectable()
export class RoutingService {
  private mediationRecipientService: MediationRecipientService
  private mediatorRepository: MediationRepository
  private agentConfig: AgentConfig
  private wallet: Wallet
  private eventEmitter: EventEmitter

  public constructor(
    mediatorRepository: MediationRepository,
    mediationRecipientService: MediationRecipientService,
    agentConfig: AgentConfig,
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    eventEmitter: EventEmitter
  ) {
    this.mediatorRepository = mediatorRepository
    this.mediationRecipientService = mediationRecipientService
    this.agentConfig = agentConfig
    this.wallet = wallet
    this.eventEmitter = eventEmitter
  }

  public async getRouting(
    did = '',
    { mediatorId, useDefaultMediator = true }: GetRoutingOptions = {}
  ): Promise<Routing> {
    let mediationRecord: MediationRecord | null = null

    if (mediatorId) {
      mediationRecord = await this.getById(mediatorId)
    } else if (useDefaultMediator) {
      // If no mediatorId is provided, and useDefaultMediator is true (default)
      // We use the default mediator if available
      mediationRecord = await this.findDefaultMediator()
    }

    if (!mediationRecord) {
      throw new AriesFrameworkError(`Mediator not found`)
    }

    // Create and store new key
    // new did has been created and mediator needs to be updated with the public key.
    mediationRecord = await this.mediationRecipientService.didListUpdateAndAwait(mediationRecord, did)

    return {
      endpoint: mediationRecord?.endpoint || '',
      routingKeys: mediationRecord?.routingKeys || [],
      mediatorId: mediationRecord?.id,
      did: '',
      verkey: '',
    }
  }

  public async getById(id: string): Promise<MediationRecord> {
    return this.mediationRecipientService.getById(id)
  }

  public async findGrantedByMediatorDid(did: string): Promise<MediationRecord | null> {
    return this.mediatorRepository.findSingleByQuery({ mediatorDid: did, state: MediationState.Granted })
  }

  public async getMediators(): Promise<MediationRecord[]> {
    return this.mediatorRepository.getAll()
  }

  public async findDefaultMediator(): Promise<MediationRecord | null> {
    return this.mediatorRepository.findSingleByQuery({ default: true })
  }
}
