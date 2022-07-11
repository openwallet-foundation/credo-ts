import type { CreateTenantOptions, GetTenantAgentOptions, WithTenantAgentCallback } from './TenantsApiOptions'

import { AgentContext, inject, InjectionSymbols, AgentContextProvider, injectable, Logger } from '@aries-framework/core'

import { TenantAgent } from './TenantAgent'
import { TenantService } from './services'

@injectable()
export class TenantsApi {
  private agentContext: AgentContext
  private tenantService: TenantService
  private agentContextProvider: AgentContextProvider
  private logger: Logger

  public constructor(
    tenantService: TenantService,
    agentContext: AgentContext,
    @inject(InjectionSymbols.AgentContextProvider) agentContextProvider: AgentContextProvider,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.tenantService = tenantService
    this.agentContext = agentContext
    this.agentContextProvider = agentContextProvider
    this.logger = logger
  }

  public async getTenantAgent({ tenantId }: GetTenantAgentOptions): Promise<TenantAgent> {
    this.logger.debug(`Getting tenant agent for tenant '${tenantId}'`)
    const tenantContext = await this.agentContextProvider.getAgentContextForContextCorrelationId(tenantId)

    this.logger.trace(`Got tenant context for tenant '${tenantId}'`)
    const tenantAgent = new TenantAgent(tenantContext)
    await tenantAgent.initialize()
    this.logger.trace(`Initializing tenant agent for tenant '${tenantId}'`)

    return tenantAgent
  }

  public async withTenantAgent(
    options: GetTenantAgentOptions,
    withTenantAgentCallback: WithTenantAgentCallback
  ): Promise<void> {
    this.logger.debug(`Getting tenant agent for tenant '${options.tenantId}' in with tenant agent callback`)
    const tenantAgent = await this.getTenantAgent(options)

    try {
      this.logger.debug(`Calling tenant agent callback for tenant '${options.tenantId}'`)
      await withTenantAgentCallback(tenantAgent)
    } catch (error) {
      this.logger.error(`Error in tenant agent callback for tenant '${options.tenantId}'`, { error })
      throw error
    } finally {
      this.logger.debug(`Shutting down tenant agent for tenant '${options.tenantId}'`)
      await tenantAgent.shutdown()
    }
  }

  public async createTenant(options: CreateTenantOptions) {
    this.logger.debug(`Creating tenant with label ${options.config.label}`)
    const tenantRecord = await this.tenantService.createTenant(this.agentContext, options.config)

    // This initializes the tenant agent, creates the wallet etc...
    const tenantAgent = await this.getTenantAgent({ tenantId: tenantRecord.id })
    await tenantAgent.shutdown()

    this.logger.info(`Successfully created tenant '${tenantRecord.id}'`)

    return tenantRecord
  }

  public async getTenantById(tenantId: string) {
    this.logger.debug(`Getting tenant by id '${tenantId}'`)
    return this.tenantService.getTenantById(this.agentContext, tenantId)
  }

  public async deleteTenantById(tenantId: string) {
    this.logger.debug(`Deleting tenant by id '${tenantId}'`)
    // TODO: force remove context from the context provider (or session manager)
    const tenantAgent = await this.getTenantAgent({ tenantId })

    this.logger.trace(`Deleting wallet for tenant '${tenantId}'`)
    await tenantAgent.wallet.delete()
    this.logger.trace(`Shutting down agent for tenant '${tenantId}'`)
    await tenantAgent.shutdown()

    return this.tenantService.deleteTenantById(this.agentContext, tenantId)
  }
}
