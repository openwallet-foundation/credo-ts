import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { OpenId4VciCredentialRequestToCredentialMapper } from '../OpenId4VcIssuerServiceOptions'
import type { HttpMethod } from '@animo-id/oauth2'
import type { Router, Response } from 'express'

import { Oauth2ErrorCodes, Oauth2ServerErrorResponseError } from '@animo-id/oauth2'
import { joinUriParts } from '@credo-ts/core'

import {
  getRequestContext,
  sendJsonResponse,
  sendOauth2ErrorResponse,
  sendUnauthorizedError,
  sendUnknownServerErrorResponse,
} from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { OpenId4VcIssuanceSessionRepository } from '../repository'

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
    const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
    // TODO: we should allow delaying fetching auth metadat until it's needed
    // also we should cache it. (both request and response)
    const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer, true)
    const resourceServer = openId4VcIssuerService.getResourceServer(agentContext)

    const fullRequestUrl = joinUriParts(issuerMetadata.credentialIssuer.credential_issuer, [config.endpointPath])
    const resourceRequestResult = await resourceServer
      .verifyResourceRequest({
        authorizationServers: issuerMetadata.authorizationServers,
        resourceServer: issuerMetadata.credentialIssuer.credential_issuer,
        request: {
          // FIXME: we need to make the input type here easier
          headers: new Headers(request.headers as Record<string, string>),
          method: request.method as HttpMethod,
          url: fullRequestUrl,
        },
      })
      .catch((error) => {
        sendUnauthorizedError(response, next, agentContext.config.logger, error)
      })
    if (!resourceRequestResult) return
    const { tokenPayload } = resourceRequestResult

    const credentialRequest = request.body
    const issuanceSessionRepository = agentContext.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)

    // TODO: we should support dynamic issuance sessions (based on config)
    const issuanceSession = await issuanceSessionRepository.findSingleByQuery(agentContext, {
      issuerId: issuer.issuerId,
      // TODO: maybe make pre-auth also custom prop to be more explicit
      ...(typeof tokenPayload.issuer_state === 'string'
        ? { issuerState: tokenPayload.issuer_state }
        : { preAuthorizedCode: tokenPayload.sub }),
    })

    if (!issuanceSession) {
      agentContext.config.logger.warn(
        `No issuance session found for incoming credential request for issuer ${issuer.issuerId} and access token data`,
        {
          tokenPayload,
        }
      )
      return sendOauth2ErrorResponse(
        response,
        next,
        agentContext.config.logger,
        new Oauth2ServerErrorResponseError(
          {
            error: Oauth2ErrorCodes.CredentialRequestDenied,
          },
          {
            internalMessage: `No issuance session found for incoming credential request for issuer ${issuer.issuerId} and access token data`,
          }
        )
      )
    }

    try {
      const { credentialResponse } = await openId4VcIssuerService.createCredentialResponse(agentContext, {
        issuanceSession,
        credentialRequest,
      })

      return sendJsonResponse(response, next, credentialResponse)
    } catch (error) {
      if (error instanceof Oauth2ServerErrorResponseError) {
        return sendOauth2ErrorResponse(response, next, agentContext.config.logger, error)
      }
      return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error)
    }
  })
}
