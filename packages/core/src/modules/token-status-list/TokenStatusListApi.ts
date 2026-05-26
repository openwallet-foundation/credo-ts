import { AgentContext } from '../../agent'
import type { Jwt } from '../../crypto'
import { injectable } from '../../plugins'
import type {
  CreateTokenStatusListOptions,
  FetchTokenStatusListOptions,
  UpdateTokenStatusListOptions,
} from './TokenStatusListOptions'
import type { StatusListCwt, TokenStatusListService } from './TokenStatusListService'

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

  public async createTokenStatusList(
    options: CreateTokenStatusListOptions
  ): Promise<
    | { format: 'cwt'; statusList: Uint8Array; parsed: StatusListCwt }
    | { format: 'jwt'; statusList: string; parsed: Jwt }
  > {
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

  public async fetchTokenStatusList(
    options: FetchTokenStatusListOptions
  ): Promise<{ raw: Uint8Array; parsed: StatusListCwt }>
  public async fetchTokenStatusList(options: FetchTokenStatusListOptions): Promise<{ raw: string; parsed: Jwt }>
  public async fetchTokenStatusList(
    options: FetchTokenStatusListOptions
  ): Promise<{ raw: Uint8Array | string; parsed: StatusListCwt | Jwt }> {
    return this.tokenStatusListService.fetchTokenStatusList(this.agentContext, options)
  }
}
