import type { OpenId4VcIssuerRecord } from '../repository'
import type { OpenId4VcIssuanceRequest } from '../router'
import type { AgentContext } from '@credo-ts/core'
import type { SigningAlgo } from '@sphereon/oid4vc-common'

import { joinUriParts } from '@credo-ts/core'
import { verifyResourceDPoP } from '@sphereon/oid4vc-common'

import { getVerifyJwtCallback } from '../../shared/utils'
import { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

export async function verifyResourceRequestDpop(
  agentContext: AgentContext,
  issuer: OpenId4VcIssuerRecord,
  request: OpenId4VcIssuanceRequest
) {
  const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
  const issuerConfig = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)
  const issuerMetadata = openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)

  const fullUrl = joinUriParts(issuerConfig.baseUrl, [issuer.issuerId, request.url])
  await verifyResourceDPoP(
    { method: request.method, headers: request.headers, fullUrl },
    {
      jwtVerifyCallback: getVerifyJwtCallback(agentContext),
      acceptedAlgorithms: issuerMetadata.dpopSigningAlgValuesSupported as SigningAlgo[] | undefined,
    }
  )
}
