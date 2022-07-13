import type { AgentContext } from '../../../agent/context/AgentContext'

import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { RecordNotFoundError } from '../../../error/RecordNotFoundError'
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

  public async getByCredentialDefinitionId(agentConext: AgentContext, credentialDefinitionId: string) {
    return this.getSingleByQuery(agentConext, { credentialDefinitionId })
  }

  public async findByCredentialDefinitionId(agentConext: AgentContext, credentialDefinitionId: string) {
    try {
      return await this.getByCredentialDefinitionId(agentConext, credentialDefinitionId)
    } catch (e) {
      if (e instanceof RecordNotFoundError) return null

      throw e
    }
  }
}
