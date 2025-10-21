import type { NextFunction, Response, Router } from 'express'
import { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuanceRequest } from './requestContext'
import { getRequestContext, sendOauth2ErrorResponse, sendUnknownServerErrorResponse } from '../../shared/router'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { Oauth2ErrorCodes, Oauth2ServerErrorResponseError } from '@openid4vc/oauth2'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import { joinUriParts, TypedArrayEncoder } from '@credo-ts/core'
import { addSecondsToDate } from '@openid4vc/utils'

export function configureRedirectEndpoint(router: Router, config: OpenId4VcIssuerModuleConfig) {
  router.get(
    config.redirectEndpoint,
    async (request: OpenId4VcIssuanceRequest, response: Response, next: NextFunction) => {
      const requestContext = getRequestContext(request)
      const { agentContext, issuer } = requestContext
      const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)

      try {
        // TODO: oid4vc-ts needs method to parse authorization response / redirect url.
        const identityBrokeringAuthorizationCode = request.query.code
        const error = request.query.error
        const identityBrokeringState = request.query.state

        if (!identityBrokeringState || typeof identityBrokeringState !== 'string') {
          throw new Oauth2ServerErrorResponseError({
            // Server error because it's an error of the identity broker
            error: Oauth2ErrorCodes.ServerError,
            error_description: `Missing required 'state' parameter`,
          })
        }

        const issuanceSession = await openId4VcIssuerService.findSingleIssuancSessionByQuery(agentContext, {
          issuerId: issuer.id,
          identityBrokeringState,
        })

        if (!issuanceSession || issuanceSession.state !== OpenId4VcIssuanceSessionState.AuthorizationInitiated) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidRequest,
              error_description: `Invalid 'state' parameter`,
            },
            {
              internalMessage: !issuanceSession
                ? `Issuance session not found for identity broker 'state' parameter '${identityBrokeringState}'`
                : `Issuance session '${issuanceSession.id}' has state '${
                    issuanceSession.state
                  }' but expected ${OpenId4VcIssuanceSessionState.AuthorizationInitiated}`,
            }
          )
        }

        if (!issuanceSession.identityBrokering?.required || !issuanceSession.identityBrokering.redirectUri) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidRequest,
              error_description: 'The session is invalid or has expired.',
            },
            {
              internalMessage: `Issuance session '${issuanceSession.id}' does not have identity brokering configured, so it's not compatible with the redirect endpoint.`,
            }
          )
        }

        if (identityBrokeringAuthorizationCode && typeof identityBrokeringAuthorizationCode === 'string') {
          const oauth2Client = openId4VcIssuerService.getOauth2Client(agentContext)

          const authorizationServerMetadata =
            await oauth2Client.fetchAuthorizationServerMetadata('https://accounts.google.com')
          if (!authorizationServerMetadata) {
            throw new Error('')
          }

          // TODO:
          // Retrieve / verify access. Then create a new redirect uri with code
          // like we already do in presentation during issuance.
          const { accessTokenResponse } = await oauth2Client
            .retrieveAuthorizationCodeAccessToken({
              authorizationCode: identityBrokeringAuthorizationCode,
              authorizationServerMetadata,
              // pkceCodeVerifier: '',
              redirectUri: joinUriParts(config.baseUrl, ['redirect']),
              // dpop
            })
            .catch((error) => {
              // TODO: we could look at the specific error, maybe we can improve the server_error code
              // if (error instanceof Oauth2ClientErrorResponseError)

              throw new Oauth2ServerErrorResponseError(
                {
                  error: Oauth2ErrorCodes.ServerError,
                  error_description: 'Error processing authorization code',
                },
                {
                  internalMessage: `Error ocurred during retrieval of access token from ${authorizationServerMetadata.issuer}.`,
                  cause: error,
                }
              )
            })

          // Grant authorization
          const authorizationCode = TypedArrayEncoder.toBase64URL(agentContext.wallet.getRandomValues(32))
          const authorizationCodeExpiresAt = addSecondsToDate(new Date(), config.authorizationCodeExpiresInSeconds)

          issuanceSession.authorization = {
            ...issuanceSession.authorization,
            code: authorizationCode,
            codeExpiresAt: authorizationCodeExpiresAt,
          }

          const redirectUri = new URL(issuanceSession.identityBrokering.redirectUri)
          redirectUri.searchParams.set('code', authorizationCode)

          if (issuanceSession.identityBrokering.state) {
            redirectUri.searchParams.set('state', issuanceSession.identityBrokering.state)
          }

          // TODO: we need to start using locks so we can't get corrupted state
          await openId4VcIssuerService.updateState(
            agentContext,
            issuanceSession,
            OpenId4VcIssuanceSessionState.AuthorizationGranted
          )

          // Need redirectUri from the request
          return response.redirect(redirectUri.toString())
        }

        if (error && typeof error === 'string') {
          issuanceSession.errorMessage = `Error ocurred during identity brokering. ${error}: ${request.query.error_description}`
          await openId4VcIssuerService.updateState(agentContext, issuanceSession, OpenId4VcIssuanceSessionState.Error)

          const redirectUri = new URL(issuanceSession.identityBrokering.redirectUri)
          redirectUri.searchParams.set('error', Oauth2ErrorCodes.ServerError)

          // TODO: correctly map the error codes from the underlying oauth2 flow
          // redirectUri.searchParams.set('error_description')

          if (issuanceSession.identityBrokering.state) {
            redirectUri.searchParams.set('state', issuanceSession.identityBrokering.state)
          }

          return response.redirect(redirectUri.toString())
        }

        throw new Oauth2ServerErrorResponseError({
          error: Oauth2ErrorCodes.ServerError,
          error_description: `Missing required 'error' or 'code' parameter`,
        })
      } catch (error) {
        // TODO: redirect to the authorization request redirect uri
        if (error instanceof Oauth2ServerErrorResponseError) {
          return sendOauth2ErrorResponse(response, next, agentContext.config.logger, error)
        }
        return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error)
      }
    }
  )
}
