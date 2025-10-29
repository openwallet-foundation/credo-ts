import { Oauth2ErrorCodes, Oauth2ServerErrorResponseError } from '@openid4vc/oauth2'
import type { NextFunction, Response, Router } from 'express'
import { getRequestContext, sendOauth2ErrorResponse, sendUnknownServerErrorResponse } from '../../shared/router'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { pushedAuthorizationRequestUriPrefix } from './pushedAuthorizationRequestEndpoint'
import type { OpenId4VcIssuanceRequest } from './requestContext'

export function configureAuthorizationEndpoint(router: Router, config: OpenId4VcIssuerModuleConfig) {
  router.get(
    config.authorizationEndpoint,
    async (request: OpenId4VcIssuanceRequest, response: Response, next: NextFunction) => {
      const requestContext = getRequestContext(request)
      const { agentContext, issuer } = requestContext
      const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)

      try {
        const requestUri = request.query.request_uri

        // TODO: validate client_id?
        if (!requestUri) {
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.InvalidRequest,
            error_description: `Missing required 'request_uri' parameter. Pushed authorization requests are required`,
          })
        }

        if (typeof requestUri !== 'string' || !requestUri.startsWith(pushedAuthorizationRequestUriPrefix)) {
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.InvalidRequest,
            error_description: `The 'request_uri' parameter is invalid or has expired.`,
          })
        }

        const requestUriReferenceValue = requestUri.replace(pushedAuthorizationRequestUriPrefix, '')
        const issuanceSession = await openId4VcIssuerService.findSingleIssuanceSessionByQuery(agentContext, {
          issuerId: issuer.issuerId,
          chainedIdentityRequestUriReferenceValue: requestUriReferenceValue,
        })
        if (!issuanceSession || issuanceSession.state !== OpenId4VcIssuanceSessionState.AuthorizationInitiated) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidRequest,
              error_description: `The 'request_uri' parameter is invalid or has expired.`,
            },
            {
              internalMessage: !issuanceSession
                ? `Issuance session not found for 'request_uri' reference value '${requestUriReferenceValue}'`
                : `Issuance session '${issuanceSession.id}' has state '${
                    issuanceSession.state
                  }' but expected ${OpenId4VcIssuanceSessionState.AuthorizationInitiated}`,
            }
          )
        }

        if (
          !issuanceSession.chainedIdentity?.externalAuthorizationServerUrl ||
          !issuanceSession.chainedIdentity.requestUriExpiresAt ||
          !issuanceSession.chainedIdentity.externalAuthorizationRequestUrl
        ) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidRequest,
              error_description: `The 'request_uri' parameter is invalid or has expired.`,
            },
            {
              internalMessage: `Issuance session '${issuanceSession.id}' does not have identity chaining configured, so it's not compatible with the authorization endpoint.`,
            }
          )
        }

        if (Date.now() > issuanceSession.chainedIdentity.requestUriExpiresAt.getTime()) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidRequest,
              error_description: `The 'request_uri' parameter is invalid or has expired.`,
            },
            {
              internalMessage: `The 'request_uri' for issuance session '${issuanceSession.id}' has expired.`,
            }
          )
        }

        return response.redirect(issuanceSession.chainedIdentity.externalAuthorizationRequestUrl)
      } catch (error) {
        if (error instanceof Oauth2ServerErrorResponseError) {
          return sendOauth2ErrorResponse(response, next, agentContext.config.logger, error)
        }
        return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error)
      }
    }
  )
}
