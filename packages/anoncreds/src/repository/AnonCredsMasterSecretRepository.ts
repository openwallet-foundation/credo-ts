import type { AgentContext } from '@aries-framework/core'

import { Repository, InjectionSymbols, StorageService, EventEmitter, injectable, inject } from '@aries-framework/core'

import { AnonCredsMasterSecretRecord } from './AnonCredsMasterSecretRecord'

@injectable()
export class AnonCredsMasterSecretRepository extends Repository<AnonCredsMasterSecretRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<AnonCredsMasterSecretRecord>,
    eventEmitter: EventEmitter
  ) {
    super(AnonCredsMasterSecretRecord, storageService, eventEmitter)
  }

  public async getDefault(agentContext: AgentContext) {
    return this.getSingleByQuery(agentContext, { default: true })
  }

  public async findDefault(agentContext: AgentContext) {
    return this.findSingleByQuery(agentContext, { default: true })
  }

  public async getByMasterSecretId(agentContext: AgentContext, masterSecretId: string) {
    return this.getSingleByQuery(agentContext, { masterSecretId })
  }

  public async findByMasterSecretId(agentContext: AgentContext, masterSecretId: string) {
    return this.findSingleByQuery(agentContext, { masterSecretId })
  }
}
