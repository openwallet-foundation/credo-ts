import type { AgentContext } from '@credo-ts/core'

import {
  EventEmitter,
  InjectionSymbols,
  inject,
  injectable,
  JsonTransformer,
  Repository,
  type StorageService,
} from '@credo-ts/core'

import type { OpenId4VciAuthorizationServerConfig } from '../../shared/models/OpenId4VciAuthorizationServerConfig'
import { getCachedValue, removeCachedValue } from '../../shared/router/requestContextCache'
import { OpenId4VcIssuerRecord, type OpenId4VcIssuerRecordWithOptionalClientSecrets } from './OpenId4VcIssuerRecord'

function withoutClientSecrets(json: Record<string, unknown>) {
  const authorizationServerConfigs = json.authorizationServerConfigs as
    | OpenId4VciAuthorizationServerConfig[]
    | undefined

  return {
    ...json,
    authorizationServerConfigs: authorizationServerConfigs?.map((config) => {
      if (!config.clientAuthentication) return config

      const { clientSecret: _, ...clientAuthentication } = config.clientAuthentication
      return { ...config, clientAuthentication }
    }),
  }
}

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

  /**
   * Like {@link getByIssuerId}, served from the request context cache when the module is configured
   * with one. Client secrets are not stored in the cache, so only a record read from storage has them.
   */
  public async getCachedByIssuerId(
    agentContext: AgentContext,
    issuerId: string
  ): Promise<OpenId4VcIssuerRecordWithOptionalClientSecrets> {
    let stored: OpenId4VcIssuerRecord | undefined
    const json = await getCachedValue(agentContext, this.getCacheKey(issuerId), async () => {
      stored = await this.getByIssuerId(agentContext, issuerId)
      return withoutClientSecrets(stored.toJSON())
    })

    return stored ?? JsonTransformer.fromJSON(json, OpenId4VcIssuerRecord)
  }

  public async update(agentContext: AgentContext, record: OpenId4VcIssuerRecord) {
    await super.update(agentContext, record)
    await this.removeFromCache(agentContext, record)
  }

  public async delete(agentContext: AgentContext, record: OpenId4VcIssuerRecord) {
    await super.delete(agentContext, record)
    await this.removeFromCache(agentContext, record)
  }

  private getCacheKey(issuerId: string) {
    return `openid4vc:issuer:${issuerId}`
  }

  private removeFromCache(agentContext: AgentContext, record: OpenId4VcIssuerRecord) {
    return removeCachedValue(agentContext, this.getCacheKey(record.issuerId))
  }
}
