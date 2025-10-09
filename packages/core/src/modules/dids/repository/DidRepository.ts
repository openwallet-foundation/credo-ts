import type { AgentContext } from '../../../agent'
import type { DidDocument } from '../domain'
import type { CustomDidTags } from './DidRecord'

import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import type { StorageService } from '../../../storage/StorageService'
import { DidDocumentRole } from '../domain/DidDocumentRole'

import { PublicJwk } from '../../kms'
import type { DidDocumentKey } from '../DidsApiOptions'
import { DidRecord } from './DidRecord'

@injectable()
export class DidRepository extends Repository<DidRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<DidRecord>,
    eventEmitter: EventEmitter
  ) {
    super(DidRecord, storageService, eventEmitter)
  }

  /**
   * Finds a {@link DidRecord}, containing the specified recipientKey that was received by this agent.
   * To find a {@link DidRecord} that was created by this agent, use {@link DidRepository.findCreatedDidByRecipientKey}.
   */
  public findReceivedDidByRecipientKey(agentContext: AgentContext, recipientKey: PublicJwk) {
    return this.findSingleByQuery(agentContext, {
      recipientKeyFingerprints: [recipientKey.fingerprint],
      role: DidDocumentRole.Received,
    })
  }

  /**
   * Finds a {@link DidRecord}, containing the specified recipientKey that was created by this agent.
   * To find a {@link DidRecord} that was received by this agent, use {@link DidRepository.findReceivedDidByRecipientKey}.
   */
  public findCreatedDidByRecipientKey(agentContext: AgentContext, recipientKey: PublicJwk) {
    return this.findSingleByQuery(agentContext, {
      recipientKeyFingerprints: [recipientKey.fingerprint],
      role: DidDocumentRole.Created,
    })
  }

  public findAllByRecipientKey(agentContext: AgentContext, recipientKey: PublicJwk) {
    return this.findByQuery(agentContext, { recipientKeyFingerprints: [recipientKey.fingerprint] })
  }

  public findAllByDid(agentContext: AgentContext, did: string) {
    return this.findByQuery(agentContext, { $or: [{ alternativeDids: [did] }, { did }] })
  }

  public findReceivedDid(agentContext: AgentContext, receivedDid: string) {
    return this.findSingleByQuery(agentContext, {
      $or: [{ alternativeDids: [receivedDid] }, { did: receivedDid }],
      role: DidDocumentRole.Received,
    })
  }

  public findCreatedDid(agentContext: AgentContext, createdDid: string) {
    return this.findSingleByQuery(agentContext, {
      $or: [{ alternativeDids: [createdDid] }, { did: createdDid }],
      role: DidDocumentRole.Created,
    })
  }

  public getCreatedDids(agentContext: AgentContext, { method, did }: { method?: string; did?: string }) {
    return this.findByQuery(agentContext, {
      role: DidDocumentRole.Created,
      method,
      $or: did ? [{ alternativeDids: [did] }, { did }] : undefined,
    })
  }

  public async storeCreatedDid(
    agentContext: AgentContext,
    { did, didDocument, tags, keys }: StoreDidOptions & { keys?: DidDocumentKey[] }
  ) {
    const didRecord = new DidRecord({
      did,
      didDocument,
      role: DidDocumentRole.Created,
      tags,
      keys,
    })

    await this.save(agentContext, didRecord)

    return didRecord
  }

  public async storeReceivedDid(agentContext: AgentContext, { did, didDocument, tags }: StoreDidOptions) {
    const didRecord = new DidRecord({
      did,
      didDocument,
      role: DidDocumentRole.Received,
      tags,
    })

    await this.save(agentContext, didRecord)

    return didRecord
  }
}

interface StoreDidOptions {
  did: string
  didDocument?: DidDocument
  tags?: CustomDidTags
  keys?: DidDocumentKey[]
}
