import type { AgentContext } from '@credo-ts/core'

import { Repository, InjectionSymbols, StorageService, EventEmitter, injectable, inject } from '@credo-ts/core'

import { AnonCredsRevocationRegistryDefinitionRecord } from './AnonCredsRevocationRegistryDefinitionRecord'

@injectable()
export class AnonCredsRevocationRegistryDefinitionRepository extends Repository<AnonCredsRevocationRegistryDefinitionRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService)
    storageService: StorageService<AnonCredsRevocationRegistryDefinitionRecord>,
    eventEmitter: EventEmitter
  ) {
    super(AnonCredsRevocationRegistryDefinitionRecord, storageService, eventEmitter)
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

  public async findAllByCredentialDefinitionId(agentContext: AgentContext, credentialDefinitionId: string) {
    return this.findByQuery(agentContext, { credentialDefinitionId })
  }
}
