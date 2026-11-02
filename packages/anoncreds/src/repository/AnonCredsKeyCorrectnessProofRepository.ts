import type { AgentContext } from '@credo-ts/core'

import { EventEmitter, InjectionSymbols, inject, injectable, Repository, type StorageService } from '@credo-ts/core'
import { didIndyIdentifierQuery } from '../utils/indyIdentifiers'

import { AnonCredsKeyCorrectnessProofRecord } from './AnonCredsKeyCorrectnessProofRecord'

@injectable()
export class AnonCredsKeyCorrectnessProofRepository extends Repository<AnonCredsKeyCorrectnessProofRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<AnonCredsKeyCorrectnessProofRecord>,
    eventEmitter: EventEmitter
  ) {
    super(AnonCredsKeyCorrectnessProofRecord, storageService, eventEmitter)
  }

  public async getByCredentialDefinitionId(agentContext: AgentContext, credentialDefinitionId: string) {
    return this.getSingleByQuery(agentContext, didIndyIdentifierQuery('credentialDefinitionId', credentialDefinitionId))
  }

  public async findByCredentialDefinitionId(agentContext: AgentContext, credentialDefinitionId: string) {
    return this.findSingleByQuery(
      agentContext,
      didIndyIdentifierQuery('credentialDefinitionId', credentialDefinitionId)
    )
  }
}
