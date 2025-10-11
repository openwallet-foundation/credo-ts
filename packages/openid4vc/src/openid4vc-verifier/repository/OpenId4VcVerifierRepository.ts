import type { AgentContext } from '@credo-ts/core'

import { EventEmitter, InjectionSymbols, Repository, type StorageService, inject, injectable } from '@credo-ts/core'

import { OpenId4VcVerifierRecord } from './OpenId4VcVerifierRecord'

@injectable()
export class OpenId4VcVerifierRepository extends Repository<OpenId4VcVerifierRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<OpenId4VcVerifierRecord>,
    eventEmitter: EventEmitter
  ) {
    super(OpenId4VcVerifierRecord, storageService, eventEmitter)
  }

  public findByVerifierId(agentContext: AgentContext, verifierId: string) {
    return this.findSingleByQuery(agentContext, { verifierId })
  }

  public getByVerifierId(agentContext: AgentContext, verifierId: string) {
    return this.getSingleByQuery(agentContext, { verifierId })
  }
}
