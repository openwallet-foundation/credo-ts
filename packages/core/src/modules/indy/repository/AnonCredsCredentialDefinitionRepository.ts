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

  public async getByCredentialDefinitionId(credentialDefinitionId: string) {
    return this.getSingleByQuery({ credentialDefinitionId })
  }

  public async findByCredentialDefinitionId(credentialDefinitionId: string) {
    try {
      return this.getByCredentialDefinitionId(credentialDefinitionId)
    } catch (e) {
      if (e instanceof RecordNotFoundError) return null

      throw e
    }
  }
}
