import type { AgentContext } from '@aries-framework/core'

import { Repository, InjectionSymbols, StorageService, EventEmitter, injectable, inject } from '@aries-framework/core'

import { AnonCredsRevocationStatusListRecord } from './AnonCredsRevocationStatusListRecord'

@injectable()
export class AnonCredsRevocationStatusListRepository extends Repository<AnonCredsRevocationStatusListRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService)
    storageService: StorageService<AnonCredsRevocationStatusListRecord>,
    eventEmitter: EventEmitter
  ) {
    super(AnonCredsRevocationStatusListRecord, storageService, eventEmitter)
  }

  public async getByRevocationRegistryDefinitionIdAndTimestamp(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string,
    timestamp: string
  ) {
    return this.getSingleByQuery(agentContext, { revocationRegistryDefinitionId, timestamp })
  }

  public async findByRevocationRegistryDefinitionIdAndTimestamp(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string,
    timestamp: string
  ) {
    return this.findSingleByQuery(agentContext, { revocationRegistryDefinitionId, timestamp })
  }

  public async findAllByCredentialDefinitionId(agentContext: AgentContext, credentialDefinitionId: string) {
    return this.findByQuery(agentContext, { credentialDefinitionId })
  }

  public async findAllByRevocationRegistryDefinitionId(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ) {
    return this.findByQuery(agentContext, { revocationRegistryDefinitionId })
  }
}
