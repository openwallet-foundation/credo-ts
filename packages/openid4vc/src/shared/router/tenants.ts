import type { AgentContext, AgentContextProvider } from '@credo-ts/core'
import { CredoError, getApiForModuleByName, InjectionSymbols } from '@credo-ts/core'
import type { TenantsModule } from '@credo-ts/tenants'
import { OpenId4VcIssuerRepository } from '../../openid4vc-issuer/repository'
import { OpenId4VcVerifierRepository } from '../../openid4vc-verifier/repository'

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
      return agentContextProvider.getAgentContextForContextCorrelationId(`tenant-${tenant.id}`)
    }
  }

  return rootAgentContext
}

/**
 * The tenants api and tenant id of the agent context, or `undefined` if multi-tenancy is not used or the
 * agent context is the root context.
 */
function getTenantForAgentContext(agentContext: AgentContext) {
  const tenantsApi = getApiForModuleByName<TenantsModule>(agentContext, 'TenantsModule')
  if (!tenantsApi || tenantsApi.rootAgentContext.contextCorrelationId === agentContext.contextCorrelationId) return

  return { tenantsApi, tenantId: agentContext.contextCorrelationId.replace('tenant-', '') }
}

async function updateActorIdsForContextCorrelationId(
  agentContext: AgentContext,
  updateActorIds: (actorIds: string[]) => string[]
) {
  const tenant = getTenantForAgentContext(agentContext)
  if (!tenant) return

  // Locked, so concurrent updates in the same tenant don't drop each other's actor ids
  await tenant.tenantsApi.updateTenantByIdWithLock(tenant.tenantId, async (tenantRecord) => {
    const actorIds = updateActorIds(tenantRecord.metadata.get<string[]>(OPENID4VC_ACTOR_IDS_METADATA_KEY) ?? [])

    tenantRecord.metadata.set(OPENID4VC_ACTOR_IDS_METADATA_KEY, actorIds)
    tenantRecord.setTag(OPENID4VC_ACTOR_IDS_METADATA_KEY, actorIds)
    return tenantRecord
  })
}

/**
 * Throws if the actor id is mapped to a tenant other than the one of the agent context, as requests for
 * the actor id would be routed to that tenant. From the root context, any tenant counts.
 */
export async function assertActorIdNotMappedToOtherTenant(agentContext: AgentContext, actorId: string) {
  const tenantsApi = getApiForModuleByName<TenantsModule>(agentContext, 'TenantsModule')
  if (!tenantsApi) return

  const tenantId = getTenantForAgentContext(agentContext)?.tenantId
  const tenants = await tenantsApi.findTenantsByQuery({ [OPENID4VC_ACTOR_IDS_METADATA_KEY]: [actorId] })
  if (tenants.some((tenant) => tenant.id !== tenantId)) {
    throw new CredoError(`An issuer or verifier with id '${actorId}' already exists`)
  }
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
  await updateActorIdsForContextCorrelationId(agentContext, (actorIds) =>
    actorIds.includes(actorId) ? actorIds : [...actorIds, actorId]
  )
}

/**
 * Remove the actor id stored by {@link storeActorIdForContextCorrelationId}, unless the other actor type
 * in the agent context still uses it. Call it after deleting the issuer or verifier record.
 */
export async function removeActorIdForContextCorrelationId(
  agentContext: AgentContext,
  actorId: string,
  deleted: 'issuer' | 'verifier'
) {
  if (!getTenantForAgentContext(agentContext)) return

  // An issuer and a verifier in the same tenant can share an id
  const { dependencyManager } = agentContext
  const otherActor =
    deleted === 'verifier'
      ? dependencyManager.isRegistered(OpenId4VcIssuerRepository, true) &&
        (await agentContext.resolve(OpenId4VcIssuerRepository).findByIssuerId(agentContext, actorId))
      : dependencyManager.isRegistered(OpenId4VcVerifierRepository, true) &&
        (await agentContext.resolve(OpenId4VcVerifierRepository).findByVerifierId(agentContext, actorId))
  if (otherActor) return

  await updateActorIdsForContextCorrelationId(agentContext, (actorIds) => actorIds.filter((id) => id !== actorId))
}
