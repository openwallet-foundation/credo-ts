import type { AgentContext } from '../../../agent/context/AgentContext'

import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { injectable, inject } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { AnonCredsCredentialDefinitionRecord } from './AnonCredsCredentialDefinitionRecord'

@injectable()
export class AnonCredsCredentialDefinitionRepository extends Repository<AnonCredsCredentialDefinitionRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<AnonCredsCredentialDefinitionRecord>,
    eventEmitter: EventEmitter
  ) {
    super(AnonCredsCredentialDefinitionRecord, storageService, eventEmitter)
  }

  public async getByUnqualifiedIdentifier(agentContext: AgentContext, unqualifiedIdentifier: string) {
    return this.getSingleByQuery(agentContext, { unqualifiedIdentifier })
  }

  public async findByUnqualifiedIdentifier(agentContext: AgentContext, unqualifiedIdentifier: string) {
    return this.findSingleByQuery(agentContext, { unqualifiedIdentifier })
  }

  public async getByQualifiedIdentifier(agentContext: AgentContext, qualifiedIdentifier: string) {
    return this.getSingleByQuery(agentContext, { qualifiedIdentifier })
  }

  public async findByQualifiedIdentifier(agentContext: AgentContext, qualifiedIdentifier: string) {
    return this.findSingleByQuery(agentContext, { qualifiedIdentifier })
  }
}
