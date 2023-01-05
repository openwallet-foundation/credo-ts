import type { CreateTenantOptions, GetTenantAgentOptions, WithTenantAgentCallback } from './TenantsApiOptions'
import type { DefaultAgentModules, ModulesMap } from '@aries-framework/core'

import { AgentContext, inject, InjectionSymbols, AgentContextProvider, injectable, Logger } from '@aries-framework/core'

import { TenantAgent } from './TenantAgent'
import { TenantRecordService } from './services'

@injectable()
export class TenantsApi<AgentModules extends ModulesMap = DefaultAgentModules> {
  private agentContext: AgentContext
  private tenantRecordService: TenantRecordService
  private agentContextProvider: AgentContextProvider
  private logger: Logger

  public constructor(
    tenantRecordService: TenantRecordService,
    agentContext: AgentContext,
    @inject(InjectionSymbols.AgentContextProvider) agentContextProvider: AgentContextProvider,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.tenantRecordService = tenantRecordService
    this.agentContext = agentContext
    this.agentContextProvider = agentContextProvider
    this.logger = logger
  }

  public async getTenantAgent({ tenantId }: GetTenantAgentOptions): Promise<TenantAgent<AgentModules>> {
    this.logger.debug(`Getting tenant agent for tenant '${tenantId}'`)
    const tenantContext = await this.agentContextProvider.getAgentContextForContextCorrelationId(tenantId)

    this.logger.trace(`Got tenant context for tenant '${tenantId}'`)
    const tenantAgent = new TenantAgent<AgentModules>(tenantContext)
    await tenantAgent.initialize()
    this.logger.trace(`Initializing tenant agent for tenant '${tenantId}'`)

    return tenantAgent
  }

  public async withTenantAgent(
    options: GetTenantAgentOptions,
    withTenantAgentCallback: WithTenantAgentCallback<AgentModules>
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
      this.logger.debug(`Ending tenant agent session for tenant '${options.tenantId}'`)
      await tenantAgent.endSession()
    }
  }

  public async createTenant(options: CreateTenantOptions) {
    this.logger.debug(`Creating tenant with label ${options.config.label}`)
    const tenantRecord = await this.tenantRecordService.createTenant(this.agentContext, options.config)

    // This initializes the tenant agent, creates the wallet etc...
    const tenantAgent = await this.getTenantAgent({ tenantId: tenantRecord.id })
    await tenantAgent.endSession()

    this.logger.info(`Successfully created tenant '${tenantRecord.id}'`)

    return tenantRecord
  }

  public async getTenantById(tenantId: string) {
    this.logger.debug(`Getting tenant by id '${tenantId}'`)
    return this.tenantRecordService.getTenantById(this.agentContext, tenantId)
  }

  public async deleteTenantById(tenantId: string) {
    this.logger.debug(`Deleting tenant by id '${tenantId}'`)
    // TODO: force remove context from the context provider (or session manager)
    const tenantAgent = await this.getTenantAgent({ tenantId })

    this.logger.trace(`Deleting wallet for tenant '${tenantId}'`)
    await tenantAgent.wallet.delete()
    this.logger.trace(`Shutting down agent for tenant '${tenantId}'`)
    await tenantAgent.endSession()

    return this.tenantRecordService.deleteTenantById(this.agentContext, tenantId)
  }
}
