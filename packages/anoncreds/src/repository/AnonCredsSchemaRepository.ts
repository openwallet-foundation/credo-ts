import type { AgentContext } from '@credo-ts/core'

import { EventEmitter, InjectionSymbols, inject, injectable, Repository, type StorageService } from '@credo-ts/core'
import { identifierQuery } from '../utils/identifierVariants'

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
    return this.getSingleByQuery(agentContext, identifierQuery(agentContext, 'schemaId', schemaId))
  }

  public async findBySchemaId(agentContext: AgentContext, schemaId: string) {
    return await this.findSingleByQuery(agentContext, identifierQuery(agentContext, 'schemaId', schemaId))
  }
}
