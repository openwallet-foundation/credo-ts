import type { AgentContext } from '@aries-framework/core'

import { Repository, InjectionSymbols, StorageService, EventEmitter, inject, injectable } from '@aries-framework/core'

import { AnonCredsSchemaRecord } from './AnonCredsSchemaRecord'

@injectable()
export class AnonCredsSchemaRepository extends Repository<AnonCredsSchemaRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<AnonCredsSchemaRecord>,
    eventEmitter: EventEmitter
  ) {
    super(AnonCredsSchemaRecord, storageService, eventEmitter)
  }

  public async getBySchemaId(agentContext: AgentContext, schemaId: string) {
    return this.getSingleByQuery(agentContext, { schemaId: schemaId })
  }

  public async findBySchemaId(agentContext: AgentContext, schemaId: string) {
    return await this.findSingleByQuery(agentContext, { schemaId: schemaId })
  }
}
