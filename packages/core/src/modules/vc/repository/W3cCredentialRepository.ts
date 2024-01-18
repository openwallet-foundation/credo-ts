import type { AgentContext } from '../../../agent'

import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { W3cCredentialRecord } from './W3cCredentialRecord'

@injectable()
export class W3cCredentialRepository extends Repository<W3cCredentialRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<W3cCredentialRecord>,
    eventEmitter: EventEmitter
  ) {
    super(W3cCredentialRecord, storageService, eventEmitter)
  }

  public async getByCredentialDefinitionId(agentContext: AgentContext, credentialDefinitionId: string) {
    return this.getSingleByQuery(agentContext, { credentialDefinitionId })
  }

  public async findByCredentialDefinitionId(agentContext: AgentContext, credentialDefinitionId: string) {
    return this.findSingleByQuery(agentContext, { credentialDefinitionId })
  }

  public async getByCredentialId(agentContext: AgentContext, credentialId: string) {
    return this.getSingleByQuery(agentContext, { credentialId })
  }
}
