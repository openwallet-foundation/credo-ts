import type { AgentContext } from '@aries-framework/core'

import { Repository, InjectionSymbols, StorageService, EventEmitter, injectable, inject } from '@aries-framework/core'

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
}
