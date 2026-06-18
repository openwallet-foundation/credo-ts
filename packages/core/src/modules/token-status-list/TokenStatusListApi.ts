import { AgentContext } from '../../agent'
import { injectable } from '../../plugins'
import type {
  CreateTokenStatusListOptions,
  FetchTokenStatusListOptions,
  TokenStatusListFormat,
  TokenStatusListResult,
  TokenStatusListResultFor,
  UpdateTokenStatusListOptions,
} from './TokenStatusListOptions'
import { TokenStatusListService } from './TokenStatusListService'

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
    options: CreateTokenStatusListOptions
  ): Promise<Extract<TokenStatusListResult, { format: Format }>> {
    return this.tokenStatusListService.createTokenStatusList(this.agentContext, options)
  }

  public async updateTokenStatusList<Format extends TokenStatusListFormat>(
    options: UpdateTokenStatusListOptions
  ): Promise<Extract<TokenStatusListResult, { format: Format }>> {
    return this.tokenStatusListService.updateTokenStatusList(this.agentContext, options)
  }

  public async fetchTokenStatusList<AcceptedFormats extends TokenStatusListFormat>(
    options: FetchTokenStatusListOptions<AcceptedFormats>
  ): Promise<TokenStatusListResultFor<AcceptedFormats>> {
    return this.tokenStatusListService.fetchTokenStatusList(this.agentContext, options)
  }
}
