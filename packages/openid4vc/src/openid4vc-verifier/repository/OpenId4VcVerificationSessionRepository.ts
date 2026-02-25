import { EventEmitter, InjectionSymbols, inject, injectable, Repository, type StorageService } from '@credo-ts/core'

import { OpenId4VcVerificationSessionRecord } from './OpenId4VcVerificationSessionRecord'

@injectable()
export class OpenId4VcVerificationSessionRepository extends Repository<OpenId4VcVerificationSessionRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<OpenId4VcVerificationSessionRecord>,
    eventEmitter: EventEmitter
  ) {
    super(OpenId4VcVerificationSessionRecord, storageService, eventEmitter)
  }
}
