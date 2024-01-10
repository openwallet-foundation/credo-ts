import type { RequestContext } from '../../shared/router'
import type { OpenId4VcIssuerRecord } from '../repository/OpenId4VcIssuerRecord'
import type { AgentContext, AgentContextProvider } from '@aries-framework/core'
import type { TenantsModule } from '@aries-framework/tenants'
import type { Request } from 'express'

import { InjectionSymbols, getApiForModuleByName } from '@aries-framework/core'

// Type is currently same as base request context
export type IssuanceRequestContext = RequestContext & { issuer: OpenId4VcIssuerRecord }
export interface IssuanceRequest extends Request {
  requestContext?: IssuanceRequestContext
}

const OPENID4VC_ISSUER_IDS_METADATA_KEY = '_openid4vc/openId4VcIssuerIds'

export async function getAgentContextForIssuerId(rootAgentContext: AgentContext, issuerId: string) {
  // Check if multi-tenancy is enabled, and if so find the associated multi-tenant record
  // This is a bit hacky as it uses the tenants module to store the openid4vc issuer id
  // but this way we don't have to expose the contextCorrelationId in the issuer metadata
  const tenantsApi = getApiForModuleByName<TenantsModule>(rootAgentContext, 'TenantsApi')
  if (tenantsApi) {
    const [tenant] = await tenantsApi.findTenantsByQuery({
      [OPENID4VC_ISSUER_IDS_METADATA_KEY]: [issuerId],
    })

    if (tenant) {
      const agentContextProvider = rootAgentContext.dependencyManager.resolve<AgentContextProvider>(
        InjectionSymbols.AgentContextProvider
      )
      await agentContextProvider.getAgentContextForContextCorrelationId(tenant.id)
    }
  }

  return rootAgentContext
}

/**
 * Store the issuer id associated with a context correlation id. If multi-tenancy is not used
 * this method won't do anything as we can just use the issuer from the default context. However
 * if multi-tenancy is used, we will store the issuer id in the tenant record metadata so it can
 * be queried when a request comes in for the specific issuer id.
 *
 * The reason for doing this is that we don't want to expose the context correlation id in the
 * issuer metadata url, as it is then possible to see exactly which issuers are registered under
 * the same agent.
 */
export async function storeIssuerIdForContextCorrelationId(agentContext: AgentContext, issuerId: string) {
  // It's kind of hacky, but we add support for the tenants module specifically here to map an issuerId to
  // a specific tenant. Otherwise we have to expose /:contextCorrelationId/:issuerId in all the public URLs
  // which is of course not so nice.
  const tenantsApi = getApiForModuleByName<TenantsModule>(agentContext, 'TenantsApi')
  // We don't want to query the tenant record if the current context is the root context
  if (tenantsApi && tenantsApi.rootAgentContext.contextCorrelationId !== agentContext.contextCorrelationId) {
    const tenantRecord = await tenantsApi.getTenantById(agentContext.contextCorrelationId)

    const openId4VcIssuerIds = tenantRecord.metadata.get<string[]>(OPENID4VC_ISSUER_IDS_METADATA_KEY) ?? []
    tenantRecord.metadata.set(OPENID4VC_ISSUER_IDS_METADATA_KEY, [...openId4VcIssuerIds, issuerId])
    await tenantsApi.updateTenant(tenantRecord)
  }
}
