import type { AgentContext } from '@credo-ts/core'

import { EventEmitter, InjectionSymbols, Repository, StorageService, inject, injectable } from '@credo-ts/core'

import { AnonCredsCredentialDefinitionRecord } from './AnonCredsCredentialDefinitionRecord'

@injectable()
export class AnonCredsCredentialDefinitionRepository extends Repository<AnonCredsCredentialDefinitionRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<AnonCredsCredentialDefinitionRecord>,
    eventEmitter: EventEmitter
  ) {
    super(AnonCredsCredentialDefinitionRecord, storageService, eventEmitter)
  }

  public async getByCredentialDefinitionId(agentContext: AgentContext, credentialDefinitionId: string) {
    return this.getSingleByQuery(agentContext, {
      $or: [
        {
          credentialDefinitionId,
        },
        {
          unqualifiedCredentialDefinitionId: credentialDefinitionId,
        },
      ],
    })
  }

  public async findByCredentialDefinitionId(agentContext: AgentContext, credentialDefinitionId: string) {
    return this.findSingleByQuery(agentContext, {
      $or: [
        {
          credentialDefinitionId,
        },
        {
          unqualifiedCredentialDefinitionId: credentialDefinitionId,
        },
      ],
    })
  }
}
