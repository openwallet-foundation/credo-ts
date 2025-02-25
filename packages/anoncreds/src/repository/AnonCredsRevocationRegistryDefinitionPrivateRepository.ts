import type { AgentContext } from '@credo-ts/core'
import type { AnonCredsRevocationRegistryState } from './AnonCredsRevocationRegistryDefinitionPrivateRecord'

import { EventEmitter, InjectionSymbols, Repository, StorageService, inject, injectable } from '@credo-ts/core'

import { AnonCredsRevocationRegistryDefinitionPrivateRecord } from './AnonCredsRevocationRegistryDefinitionPrivateRecord'

@injectable()
export class AnonCredsRevocationRegistryDefinitionPrivateRepository extends Repository<AnonCredsRevocationRegistryDefinitionPrivateRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService)
    storageService: StorageService<AnonCredsRevocationRegistryDefinitionPrivateRecord>,
    eventEmitter: EventEmitter
  ) {
    super(AnonCredsRevocationRegistryDefinitionPrivateRecord, storageService, eventEmitter)
  }

  public async getByRevocationRegistryDefinitionId(agentContext: AgentContext, revocationRegistryDefinitionId: string) {
    return this.getSingleByQuery(agentContext, { revocationRegistryDefinitionId })
  }

  public async findByRevocationRegistryDefinitionId(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ) {
    return this.findSingleByQuery(agentContext, { revocationRegistryDefinitionId })
  }

  public async findAllByCredentialDefinitionIdAndState(
    agentContext: AgentContext,
    credentialDefinitionId: string,
    state?: AnonCredsRevocationRegistryState
  ) {
    return this.findByQuery(agentContext, { credentialDefinitionId, state })
  }
}
