import type { AgentContext, AgentContextProvider } from '@credo-ts/core'
import type { TenantsModule } from '@credo-ts/tenants'

import { InjectionSymbols, getApiForModuleByName } from '@credo-ts/core'

const OPENID4VC_ACTOR_IDS_METADATA_KEY = '_openid4vc/openId4VcActorIds'

export async function getAgentContextForActorId(rootAgentContext: AgentContext, actorId: string) {
  // Check if multi-tenancy is enabled, and if so find the associated multi-tenant record
  // This is a bit hacky as it uses the tenants module to store the openid4vc actor id
  // but this way we don't have to expose the contextCorrelationId in the openid metadata
  const tenantsApi = getApiForModuleByName<TenantsModule>(rootAgentContext, 'TenantsModule')
  if (tenantsApi) {
    const [tenant] = await tenantsApi.findTenantsByQuery({
      [OPENID4VC_ACTOR_IDS_METADATA_KEY]: [actorId],
    })

    if (tenant) {
      const agentContextProvider = rootAgentContext.dependencyManager.resolve<AgentContextProvider>(
        InjectionSymbols.AgentContextProvider
      )
      return agentContextProvider.getAgentContextForContextCorrelationId(tenant.id)
    }
  }

  return rootAgentContext
}

/**
 * Store the actor id associated with a context correlation id. If multi-tenancy is not used
 * this method won't do anything as we can just use the actor from the default context. However
 * if multi-tenancy is used, we will store the actor id in the tenant record metadata so it can
 * be queried when a request comes in for the specific actor id.
 *
 * The reason for doing this is that we don't want to expose the context correlation id in the
 * actor metadata url, as it is then possible to see exactly which actors are registered under
 * the same agent.
 */
export async function storeActorIdForContextCorrelationId(agentContext: AgentContext, actorId: string) {
  // It's kind of hacky, but we add support for the tenants module specifically here to map an actorId to
  // a specific tenant. Otherwise we have to expose /:contextCorrelationId/:actorId in all the public URLs
  // which is of course not so nice.
  const tenantsApi = getApiForModuleByName<TenantsModule>(agentContext, 'TenantsModule')

  // We don't want to query the tenant record if the current context is the root context
  if (tenantsApi && tenantsApi.rootAgentContext.contextCorrelationId !== agentContext.contextCorrelationId) {
    const tenantRecord = await tenantsApi.getTenantById(agentContext.contextCorrelationId)

    const currentOpenId4VcActorIds = tenantRecord.metadata.get<string[]>(OPENID4VC_ACTOR_IDS_METADATA_KEY) ?? []
    const openId4VcActorIds = [...currentOpenId4VcActorIds, actorId]

    tenantRecord.metadata.set(OPENID4VC_ACTOR_IDS_METADATA_KEY, openId4VcActorIds)
    tenantRecord.setTag(OPENID4VC_ACTOR_IDS_METADATA_KEY, openId4VcActorIds)
    await tenantsApi.updateTenant(tenantRecord)
  }
}
