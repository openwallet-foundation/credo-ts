import type { AgentContext } from '../../../agent'
import type { Key } from '../../../crypto'

import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { inject, injectable } from '../../../plugins'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'
import { DidDocumentRole } from '../domain/DidDocumentRole'

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
  public findReceivedDidByRecipientKey(agentContext: AgentContext, recipientKey: Key) {
    return this.findSingleByQuery(agentContext, {
      recipientKeyFingerprints: [recipientKey.fingerprint],
      role: DidDocumentRole.Received,
    })
  }

  /**
   * Finds a {@link DidRecord}, containing the specified recipientKey that was created by this agent.
   * To find a {@link DidRecord} that was received by this agent, use {@link DidRepository.findReceivedDidByRecipientKey}.
   */
  public findCreatedDidByRecipientKey(agentContext: AgentContext, recipientKey: Key) {
    return this.findSingleByQuery(agentContext, {
      recipientKeyFingerprints: [recipientKey.fingerprint],
      role: DidDocumentRole.Created,
    })
  }

  public findAllByRecipientKey(agentContext: AgentContext, recipientKey: Key) {
    return this.findByQuery(agentContext, { recipientKeyFingerprints: [recipientKey.fingerprint] })
  }

  public findAllByDid(agentContext: AgentContext, did: string) {
    return this.findByQuery(agentContext, { did })
  }

  public findReceivedDid(agentContext: AgentContext, receivedDid: string) {
    return this.findSingleByQuery(agentContext, { did: receivedDid, role: DidDocumentRole.Received })
  }

  public findCreatedDid(agentContext: AgentContext, createdDid: string) {
    return this.findSingleByQuery(agentContext, { did: createdDid, role: DidDocumentRole.Created })
  }

  public getCreatedDids(agentContext: AgentContext, { method, did }: { method?: string; did?: string }) {
    return this.findByQuery(agentContext, {
      role: DidDocumentRole.Created,
      method,
      did,
    })
  }
}
