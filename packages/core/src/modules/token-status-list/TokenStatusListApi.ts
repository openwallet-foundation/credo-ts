import { AgentContext } from '../../agent'
import { injectable } from '../../plugins'
import type {
  BatchUpdateTokenStatusListOptions,
  CreateTokenStatusListOptions,
  FetchTokenStatusListOptions,
  UpdateTokenStatusListOptions,
} from './TokenStatusListOptions'
import type { TokenStatusListService } from './TokenStatusListService'

/**
 * @public
 */
@injectable()
export class TokenStatusListApi {
  private agentContext: AgentContext
  private tokenStatusListService: TokenStatusListService

  public constructor(agentContext: AgentContext, tokenStatusListService: TokenStatusListService) {
    this.agentContext = agentContext
    this.tokenStatusListService = tokenStatusListService
  }

  public async createTokenStatusList(options: CreateTokenStatusListOptions): Promise<Uint8Array | string> {
    return this.tokenStatusListService.createTokenStatusList(this.agentContext, options)
  }

  public async updateTokenStatusList<TSL extends Uint8Array | string>(
    options: UpdateTokenStatusListOptions<TSL>
  ): Promise<TSL> {
    return this.tokenStatusListService.updateTokenStatusList<TSL>(this.agentContext, options)
  }

  public async batchUpdateTokenStatusList<TSL extends Uint8Array | string>(
    options: BatchUpdateTokenStatusListOptions<TSL>
  ): Promise<TSL> {
    return this.tokenStatusListService.batchUpdateTokenStatusList<TSL>(this.agentContext, options)
  }

  public async fetchTokenStatusList<TSL extends Uint8Array | string = Uint8Array | string>(
    options: FetchTokenStatusListOptions
  ): Promise<TSL> {
    return this.tokenStatusListService.fetchTokenStatusList<TSL>(this.agentContext, options)
  }
}
