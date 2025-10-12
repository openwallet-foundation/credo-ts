import type { AgentContext } from '@credo-ts/core'

import { EventEmitter, InjectionSymbols, inject, injectable, Repository, type StorageService } from '@credo-ts/core'

import { AnonCredsLinkSecretRecord } from './AnonCredsLinkSecretRecord'

@injectable()
export class AnonCredsLinkSecretRepository extends Repository<AnonCredsLinkSecretRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<AnonCredsLinkSecretRecord>,
    eventEmitter: EventEmitter
  ) {
    super(AnonCredsLinkSecretRecord, storageService, eventEmitter)
  }

  public async getDefault(agentContext: AgentContext) {
    return this.getSingleByQuery(agentContext, { isDefault: true })
  }

  public async findDefault(agentContext: AgentContext) {
    return this.findSingleByQuery(agentContext, { isDefault: true })
  }

  public async getByLinkSecretId(agentContext: AgentContext, linkSecretId: string) {
    return this.getSingleByQuery(agentContext, { linkSecretId })
  }

  public async findByLinkSecretId(agentContext: AgentContext, linkSecretId: string) {
    return this.findSingleByQuery(agentContext, { linkSecretId })
  }
}
