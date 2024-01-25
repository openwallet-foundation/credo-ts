import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { OpenId4VciCredentialRequest } from '../../shared'
import type { OpenId4VciCredentialRequestToCredentialMapper } from '../OpenId4VcIssuerServiceOptions'
import type { Router, Response } from 'express'

import { getRequestContext, sendErrorResponse } from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

export interface OpenId4VciCredentialEndpointConfig {
  /**
   * The path at which the credential endpoint should be made available. Note that it will be
   * hosted at a subpath to take into account multiple tenants and issuers.
   *
   * @default /credential
   */
  endpointPath: string

  /**
   * A function mapping a credential request to the credential to be issued.
   */
  credentialRequestToCredentialMapper: OpenId4VciCredentialRequestToCredentialMapper
}

export function configureCredentialEndpoint(router: Router, config: OpenId4VciCredentialEndpointConfig) {
  router.post(config.endpointPath, async (request: OpenId4VcIssuanceRequest, response: Response, next) => {
    const { agentContext, issuer } = getRequestContext(request)

    try {
      const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
      const credentialRequest = request.body as OpenId4VciCredentialRequest
      const issueCredentialResponse = await openId4VcIssuerService.createCredentialResponse(agentContext, {
        issuer,
        credentialRequest,
      })

      response.json(issueCredentialResponse)
    } catch (error) {
      sendErrorResponse(response, agentContext.config.logger, 500, 'invalid_request', error)
    }

    // NOTE: if we don't call next, the agentContext session handler will NOT be called
    next()
  })
}
