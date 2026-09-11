import type { AgentContext } from '@credo-ts/core'

import {
  EventEmitter,
  getDidPeer4ShortFormForEquivalence,
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
   * did:peer:4 long form is canonicalized to short form before querying.
   * The mediator stores canonical routing DIDs at keylist-update time.
   */
  public async getSingleByRecipientDid(agentContext: AgentContext, recipientDid: string) {
    const canonicalDid = getDidPeer4ShortFormForEquivalence(recipientDid) ?? recipientDid
    return this.getSingleByQuery(agentContext, { recipientDids: [canonicalDid] })
  }

  public async findSingleByRecipientDid(agentContext: AgentContext, recipientDid: string) {
    const canonicalDid = getDidPeer4ShortFormForEquivalence(recipientDid) ?? recipientDid
    return this.findSingleByQuery(agentContext, { recipientDids: [canonicalDid] })
  }

  public async getByConnectionId(agentContext: AgentContext, connectionId: string) {
    return this.getSingleByQuery(agentContext, { connectionId })
  }
}
