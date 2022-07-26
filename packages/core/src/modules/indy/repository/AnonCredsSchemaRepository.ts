import type { AgentContext } from '../../../agent/context/AgentContext'

import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { injectable, inject } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { AnonCredsSchemaRecord } from './AnonCredsSchemaRecord'

@injectable()
export class AnonCredsSchemaRepository extends Repository<AnonCredsSchemaRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<AnonCredsSchemaRecord>,
    eventEmitter: EventEmitter
  ) {
    super(AnonCredsSchemaRecord, storageService, eventEmitter)
  }

  public async getByUnqualifiedIdentifier(agentContext: AgentContext, unqualifiedIdentifier: string) {
    return this.getSingleByQuery(agentContext, { unqualifiedIdentifier })
  }

  public async findByUnqualifiedIdentifier(agentContext: AgentContext, unqualifiedIdentifier: string) {
    return await this.findSingleByQuery(agentContext, { unqualifiedIdentifier })
  }

  public async getByQualifiedIdentifier(agentContext: AgentContext, qualifiedIdentifier: string) {
    return this.getSingleByQuery(agentContext, { qualifiedIdentifier })
  }

  public async findByQualifiedIdentifier(agentContext: AgentContext, qualifiedIdentifier: string) {
    return await this.findSingleByQuery(agentContext, { qualifiedIdentifier })
  }
}
