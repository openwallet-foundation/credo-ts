import type { AgentContext } from '@credo-ts/core'

import { EventEmitter, InjectionSymbols, Repository, StorageService, inject, injectable } from '@credo-ts/core'

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
    return this.getSingleByQuery(agentContext, {
      $or: [
        {
          schemaId,
        },
        {
          unqualifiedSchemaId: schemaId,
        },
      ],
    })
  }

  public async findBySchemaId(agentContext: AgentContext, schemaId: string) {
    return await this.findSingleByQuery(agentContext, {
      $or: [
        {
          schemaId,
        },
        {
          unqualifiedSchemaId: schemaId,
        },
      ],
    })
  }
}
