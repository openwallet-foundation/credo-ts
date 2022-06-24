import { scoped, Lifecycle, inject } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { RecordNotFoundError } from '../../../error/RecordNotFoundError'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'

import { AnonCredsCredentialDefinitionRecord } from './AnonCredsCredentialDefinitionRecord'

@scoped(Lifecycle.ContainerScoped)
export class AnonCredsCredentialDefinitionRepository extends Repository<AnonCredsCredentialDefinitionRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<AnonCredsCredentialDefinitionRecord>,
    eventEmitter: EventEmitter
  ) {
    super(AnonCredsCredentialDefinitionRecord, storageService, eventEmitter)
  }

  public async findByCredentialDefinitionId(
    credentialDefinitionId: string
  ): Promise<AnonCredsCredentialDefinitionRecord | null> {
    try {
      return await this.getByCredentialDefinitionId(credentialDefinitionId)
    } catch (e) {
      if (e instanceof RecordNotFoundError) return null

      throw e
    }
  }

  public async getByCredentialDefinitionId(credentialDefinitionId: string) {
    return this.getSingleByQuery({ credentialDefinitionId: credentialDefinitionId })
  }
}
