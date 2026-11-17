import type { AgentContext } from '../../../agent'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { RecordDuplicateError } from '../../../error'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import type { StorageService } from '../../../storage/StorageService'
import { PublicJwk } from '../../kms'
import type { DidDocumentKey } from '../DidsApiOptions'
import type { DidDocument } from '../domain'
import { DidDocumentRole } from '../domain/DidDocumentRole'
import type { CustomDidTags } from './DidRecord'
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
    return this.findSingleByRecipientKeyAndRole(agentContext, recipientKey, DidDocumentRole.Received)
  }

  /**
   * Finds a {@link DidRecord}, containing the specified recipientKey that was created by this agent.
   * To find a {@link DidRecord} that was received by this agent, use {@link DidRepository.findReceivedDidByRecipientKey}.
   */
  public findCreatedDidByRecipientKey(agentContext: AgentContext, recipientKey: PublicJwk) {
    return this.findSingleByRecipientKeyAndRole(agentContext, recipientKey, DidDocumentRole.Created)
  }

  private async findSingleByRecipientKeyAndRole(
    agentContext: AgentContext,
    recipientKey: PublicJwk,
    role: DidDocumentRole
  ) {
    // Query the selective key tag and filter the low-selectivity role in memory.
    const records = await this.findAllByRecipientKey(agentContext, recipientKey)
    return this.getSingleRecord(
      records.filter((record) => record.role === role),
      { recipientKeyFingerprints: [recipientKey.fingerprint], role }
    )
  }

  private getSingleRecord(records: DidRecord[], query: object): DidRecord | null {
    if (records.length > 1) {
      throw new RecordDuplicateError(`Multiple records found for given query '${JSON.stringify(query)}'`, {
        recordType: DidRecord.type,
      })
    }

    return records[0] ?? null
  }

  public findAllByRecipientKey(agentContext: AgentContext, recipientKey: PublicJwk) {
    return this.findByQuery(agentContext, { recipientKeyFingerprints: [recipientKey.fingerprint] })
  }

  public async findAllByDid(agentContext: AgentContext, did: string) {
    // Keep scalar and array-containment lookups separate, and run sequentially for wallet stores.
    const byDid = await this.findByQuery(agentContext, { did })
    const byAlternativeDid = await this.findByQuery(agentContext, { alternativeDids: [did] })
    return [...new Map([...byDid, ...byAlternativeDid].map((record) => [record.id, record])).values()]
  }

  public findReceivedDid(agentContext: AgentContext, receivedDid: string) {
    return this.findSingleByDidAndRole(agentContext, receivedDid, DidDocumentRole.Received)
  }

  public findCreatedDid(agentContext: AgentContext, createdDid: string) {
    return this.findSingleByDidAndRole(agentContext, createdDid, DidDocumentRole.Created)
  }

  private async findSingleByDidAndRole(agentContext: AgentContext, did: string, role: DidDocumentRole) {
    const records = await this.findAllByDid(agentContext, did)
    return this.getSingleRecord(
      records.filter((record) => record.role === role),
      { $or: [{ alternativeDids: [did] }, { did }], role }
    )
  }

  public async getCreatedDids(agentContext: AgentContext, { method, did }: { method?: string; did?: string }) {
    const query = { role: DidDocumentRole.Created, method }
    if (!did) return this.findByQuery(agentContext, query)

    const byDid = await this.findByQuery(agentContext, { ...query, did })
    const byAlternativeDid = await this.findByQuery(agentContext, {
      ...query,
      alternativeDids: [did],
    })
    return [...new Map([...byDid, ...byAlternativeDid].map((record) => [record.id, record])).values()]
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
