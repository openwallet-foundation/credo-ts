import type { AgentContext } from '@credo-ts/core'

import { EventEmitter, InjectionSymbols, inject, injectable, Repository, type StorageService } from '@credo-ts/core'

import { getCachedRecord, removeCachedValue } from '../../shared/router/requestContextCache'
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

  /**
   * Like {@link getByVerifierId}, served from the request context cache when the module is configured
   * with one. The returned record can be outdated, so it must not be written back to storage.
   */
  public getCachedByVerifierId(agentContext: AgentContext, verifierId: string) {
    return getCachedRecord(agentContext, this.getCacheKey(verifierId), OpenId4VcVerifierRecord, () =>
      this.getByVerifierId(agentContext, verifierId)
    )
  }

  public async update(agentContext: AgentContext, record: OpenId4VcVerifierRecord) {
    await super.update(agentContext, record)
    await this.removeFromCache(agentContext, record)
  }

  public async delete(agentContext: AgentContext, record: OpenId4VcVerifierRecord) {
    await super.delete(agentContext, record)
    await this.removeFromCache(agentContext, record)
  }

  private getCacheKey(verifierId: string) {
    return `openid4vc:verifier:${verifierId}`
  }

  private removeFromCache(agentContext: AgentContext, record: OpenId4VcVerifierRecord) {
    return removeCachedValue(agentContext, this.getCacheKey(record.verifierId))
  }
}
