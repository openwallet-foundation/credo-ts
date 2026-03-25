import type { AgentContext } from '@credo-ts/core'

import {
  areEquivalentDidPeer4Forms,
  didKeyToVerkey,
  EventEmitter,
  getAlternativeDidsForNumAlgo4Did,
  getEd25519DidKeysFromLongFormDidPeer4,
  InjectionSymbols,
  inject,
  injectable,
  isDidKey,
  isLongFormDidPeer4,
  isShortFormDidPeer4,
  RecordDuplicateError,
  RecordNotFoundError,
  Repository,
  type StorageService,
} from '@credo-ts/core'

import { DidCommMediationRole } from '../models/DidCommMediationRole'
import { DidCommMediationState } from '../models/DidCommMediationState'
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

  /**
   * Resolves a mediation record whose keylist includes this recipient DID.
   * CM2 may register the short did:peer:4 form while forwards use the long form (or the reverse);
   * this method tries equivalent encodings before falling back to a granted-mediator scan for short-form lookups.
   */
  public async getSingleByRecipientDid(agentContext: AgentContext, recipientDid: string): Promise<DidCommMediationRecord> {
    const variants = this.recipientDidQueryVariants(recipientDid)
    let lastNotFound: RecordNotFoundError | undefined
    for (const did of variants) {
      try {
        return await this.getSingleByQuery(agentContext, {
          recipientDids: [did],
        })
      } catch (err) {
        if (err instanceof RecordNotFoundError) {
          lastNotFound = err
          continue
        }
        throw err
      }
    }

    // Scan when did:peer:4 (short or long): storage uses exact tag match; equivalence covers long-short convertions.
    if (isShortFormDidPeer4(recipientDid) || isLongFormDidPeer4(recipientDid)) {
      const grantedMediators = await this.findGrantedMediatorRecords(agentContext)
      const matches = grantedMediators.filter((rec) =>
        (rec.recipientDids ?? []).some((rd) => areEquivalentDidPeer4Forms(recipientDid, rd))
      )
      if (matches.length === 1) {
        return matches[0]
      }
      if (matches.length > 1) {
        throw new RecordDuplicateError(
          `Multiple mediation records match did:peer:4 recipient '${recipientDid}'`,
          { recordType: DidCommMediationRecord.type }
        )
      }
    }

    // Forward `next` is often long did:peer:4 while CM2 keylist may register only did:key (same Ed25519 key).
    if (isLongFormDidPeer4(recipientDid)) {
      const peerVerkeys = new Set(
        getEd25519DidKeysFromLongFormDidPeer4(recipientDid)
          .map((dk) => {
            try {
              return didKeyToVerkey(dk)
            } catch {
              return undefined
            }
          })
          .filter((v): v is string => Boolean(v))
      )
      if (peerVerkeys.size > 0) {
        const grantedMediators = await this.findGrantedMediatorRecords(agentContext)
        const keylistMatches = grantedMediators.filter((rec) => {
          const didMatch = (rec.recipientDids ?? []).some((rd) => {
            if (!isDidKey(rd)) return false
            try {
              return peerVerkeys.has(didKeyToVerkey(rd))
            } catch {
              return false
            }
          })
          const legacyKeyMatch = (rec.recipientKeys ?? []).some((rk) => peerVerkeys.has(rk))
          return didMatch || legacyKeyMatch
        })
        if (keylistMatches.length === 1) {
          return keylistMatches[0]
        }
        if (keylistMatches.length > 1) {
          throw new RecordDuplicateError(
            `Multiple mediation records match did:peer:4 / did:key recipient '${recipientDid}'`,
            { recordType: DidCommMediationRecord.type }
          )
        }
      }
    }

    throw lastNotFound ?? new RecordNotFoundError(`No record found for recipientDid '${recipientDid}'`, {
      recordType: DidCommMediationRecord.type,
    })
  }

  private async findGrantedMediatorRecords(agentContext: AgentContext): Promise<DidCommMediationRecord[]> {
    let grantedMediators = await this.findByQuery(agentContext, {
      role: DidCommMediationRole.Mediator,
      state: DidCommMediationState.Granted,
    })
    if (grantedMediators.length === 0) {
      const all = await this.getAll(agentContext)
      grantedMediators = all.filter(
        (r) => r.role === DidCommMediationRole.Mediator && r.state === DidCommMediationState.Granted
      )
    }
    return grantedMediators
  }

  private recipientDidQueryVariants(recipientDid: string): string[] {
    const ordered = new Set<string>([recipientDid])
    const fromLong = getAlternativeDidsForNumAlgo4Did(recipientDid)
    fromLong?.forEach((d) => ordered.add(d))
    return [...ordered]
  }

  public async getByConnectionId(agentContext: AgentContext, connectionId: string): Promise<DidCommMediationRecord> {
    return this.getSingleByQuery(agentContext, { connectionId })
  }
}
