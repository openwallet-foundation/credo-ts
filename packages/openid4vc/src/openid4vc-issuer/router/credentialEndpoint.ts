import type { IssuanceRequest } from './requestContext'
import type { CredentialEndpointConfig } from '../OpenId4VcIssuerServiceOptions'
import type { CredentialRequestV1_0_11 } from '@sphereon/oid4vci-common'
import type { Router, Response } from 'express'

import { getRequestContext, sendErrorResponse } from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

export function configureCredentialEndpoint(router: Router, config: CredentialEndpointConfig) {
  router.post(config.endpointPath, async (request: IssuanceRequest, response: Response) => {
    const requestContext = getRequestContext(request)
    const { agentContext, issuer } = requestContext
    const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)

    try {
      const credentialRequest = request.body as CredentialRequestV1_0_11
      const issueCredentialResponse = await openId4VcIssuerService.createCredentialResponse(agentContext, {
        issuer,
        credentialRequest,
      })

      return response.send(issueCredentialResponse)
    } catch (e) {
      sendErrorResponse(response, agentContext.config.logger, 500, 'invalid_request', e)
    }
  })
}
