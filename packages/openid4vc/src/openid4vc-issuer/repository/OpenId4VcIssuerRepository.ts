import type { AgentContext } from '@credo-ts/core'

import { Repository, StorageService, InjectionSymbols, EventEmitter, inject, injectable } from '@credo-ts/core'

import { OpenId4VcIssuerRecord } from './OpenId4VcIssuerRecord'

@injectable()
export class OpenId4VcIssuerRepository extends Repository<OpenId4VcIssuerRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<OpenId4VcIssuerRecord>,
    eventEmitter: EventEmitter
  ) {
    super(OpenId4VcIssuerRecord, storageService, eventEmitter)
  }

  public findByIssuerId(agentContext: AgentContext, issuerId: string) {
    return this.findSingleByQuery(agentContext, { issuerId })
  }

  public getByIssuerId(agentContext: AgentContext, issuerId: string) {
    return this.getSingleByQuery(agentContext, { issuerId })
  }
}
