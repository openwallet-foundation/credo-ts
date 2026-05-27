import type { StatusListCwt } from '@owf/token-status-list'
import { AgentContext } from '../../agent'
import type { Jwt } from '../../crypto'
import { injectable } from '../../plugins'
import type {
  CreateTokenStatusListOptions,
  FetchTokenStatusListOptions,
  TokenStatusListFormat,
  TokenStatusListResult,
  TokenStatusListResultFor,
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

  public async createTokenStatusList<Format extends TokenStatusListFormat>(
    options: CreateTokenStatusListOptions<Format>
  ): Promise<Extract<TokenStatusListResult, { format: Format }>> {
    return this.tokenStatusListService.createTokenStatusList(this.agentContext, options)
  }

  public async updateTokenStatusList(
    options: UpdateTokenStatusListOptions<string>
  ): Promise<{ statusList: string; parsed: Jwt }>
  public async updateTokenStatusList(
    options: UpdateTokenStatusListOptions<Uint8Array>
  ): Promise<{ statusList: Uint8Array; parsed: StatusListCwt }>
  public async updateTokenStatusList(
    options: UpdateTokenStatusListOptions<Uint8Array | string>
  ): Promise<{ statusList: Uint8Array | string; parsed: StatusListCwt | Jwt }> {
    return this.tokenStatusListService.updateTokenStatusList(
      this.agentContext,
      options as UpdateTokenStatusListOptions<Uint8Array>
    )
  }

  public async fetchTokenStatusList<AcceptedFormats extends TokenStatusListFormat>(
    options: FetchTokenStatusListOptions<AcceptedFormats>
  ): Promise<TokenStatusListResultFor<AcceptedFormats>> {
    return this.tokenStatusListService.fetchTokenStatusList(this.agentContext, options)
  }
}
