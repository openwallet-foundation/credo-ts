import type { AgentContext } from '@credo-ts/core'

import { EventEmitter, InjectionSymbols, inject, injectable, Repository, type StorageService } from '@credo-ts/core'
import { identifierQuery } from '../utils/identifierVariants'

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
    return this.getSingleByQuery(
      agentContext,
      identifierQuery(agentContext, 'revocationRegistryDefinitionId', revocationRegistryDefinitionId)
    )
  }

  public async findByRevocationRegistryDefinitionId(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ) {
    return this.findSingleByQuery(
      agentContext,
      identifierQuery(agentContext, 'revocationRegistryDefinitionId', revocationRegistryDefinitionId)
    )
  }

  public async findAllByCredentialDefinitionId(agentContext: AgentContext, credentialDefinitionId: string) {
    return this.findByQuery(
      agentContext,
      identifierQuery(agentContext, 'credentialDefinitionId', credentialDefinitionId)
    )
  }
}
