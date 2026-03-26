import type { AgentContext } from '@credo-ts/core'

import {
  EventEmitter,
  getRecipientDidQueryVariants,
  InjectionSymbols,
  inject,
  injectable,
  Repository,
  type StorageService,
} from '@credo-ts/core'

import { DidCommMediationRecord } from './DidCommMediationRecord'

@injectable()
export class DidCommMediationRepository extends Repository<DidCommMediationRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<DidCommMediationRecord>,
    eventEmitter: EventEmitter
  ) {
    super(DidCommMediationRecord, storageService, eventEmitter)
  }

  public getSingleByRecipientKey(agentContext: AgentContext, recipientKey: string) {
    return this.getSingleByQuery(agentContext, {
      recipientKeys: [recipientKey],
    })
  }

  public findSingleByRecipientKey(agentContext: AgentContext, recipientKey: string) {
    return this.findSingleByQuery(agentContext, {
      recipientKeys: [recipientKey],
    })
  }

  /**
   * Resolves a mediation record whose keylist includes this recipient DID.
   *
   * For did:peer:4, both short and long forms are queried in a single `$or` round-trip.
   * The mediator is expected to store all queryable forms at keylist-update time
   * (see `processKeylistUpdateV2`). A storage migration backfills historical records.
   */
  public async getSingleByRecipientDid(agentContext: AgentContext, recipientDid: string) {
    const variants = getRecipientDidQueryVariants(recipientDid)
    return this.getSingleByQuery(agentContext, {
      $or: variants.map((did) => ({ recipientDids: [did] })),
    })
  }

  public async findSingleByRecipientDid(agentContext: AgentContext, recipientDid: string) {
    const variants = getRecipientDidQueryVariants(recipientDid)
    return this.findSingleByQuery(agentContext, {
      $or: variants.map((did) => ({ recipientDids: [did] })),
    })
  }

  public async getByConnectionId(agentContext: AgentContext, connectionId: string) {
    return this.getSingleByQuery(agentContext, { connectionId })
  }
}
