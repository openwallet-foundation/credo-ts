import { type AgentContext, injectable } from '@credo-ts/core'
import { HederaAnoncredsRegistry } from '@hiero-did-sdk-js/anoncreds'
import { HederaModuleConfig } from '../.'
import { HederaLedgerServiceCache } from './HederaLedgerServiceCache'

@injectable()
export class HederaLedgerService {
  private readonly config: HederaModuleConfig

  public constructor(config: HederaModuleConfig) {
    this.config = config
  }

  public getHederaAnonCredsSdk(agentContext: AgentContext): HederaAnoncredsRegistry {
    const cache = this.config.options.cache ?? new HederaLedgerServiceCache(agentContext)
    return new HederaAnoncredsRegistry({ ...this.config.options, cache: cache })
  }
}
