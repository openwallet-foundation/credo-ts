import type { CreateTenantOptions, GetTenantAgentOptions } from './TenantsApiOptions'

import { AgentContext, inject, InjectionSymbols, AgentContextProvider, injectable } from '@aries-framework/core'

import { TenantAgent } from './TenantAgent'
import { TenantService } from './services'

@injectable()
export class TenantsApi {
  private agentContext: AgentContext
  private tenantService: TenantService
  private agentContextProvider: AgentContextProvider

  public constructor(
    tenantService: TenantService,
    agentContext: AgentContext,
    @inject(InjectionSymbols.AgentContextProvider) agentContextProvider: AgentContextProvider
  ) {
    this.tenantService = tenantService
    this.agentContext = agentContext
    this.agentContextProvider = agentContextProvider
  }

  public async getTenantAgent({ tenantId }: GetTenantAgentOptions): Promise<TenantAgent> {
    const tenantContext = await this.agentContextProvider.getAgentContextForContextCorrelationId(tenantId)

    const tenantAgent = new TenantAgent(tenantContext)
    await tenantAgent.initialize()

    return tenantAgent
  }

  public async createTenant(options: CreateTenantOptions) {
    const tenantRecord = await this.tenantService.createTenant(this.agentContext, options.config)

    // This initializes the tenant agent, creates the wallet etc...
    const tenantAgent = await this.getTenantAgent({ tenantId: tenantRecord.id })
    await tenantAgent.shutdown()

    return tenantRecord
  }

  public async getTenantById(tenantId: string) {
    return this.tenantService.getTenantById(this.agentContext, tenantId)
  }

  public async deleteTenantById(tenantId: string) {
    // TODO: force remove context from the context provider (or session manager)
    const tenantAgent = await this.getTenantAgent({ tenantId })

    await tenantAgent.wallet.delete()
    await tenantAgent.shutdown()

    return this.tenantService.deleteTenantById(this.agentContext, tenantId)
  }
}
