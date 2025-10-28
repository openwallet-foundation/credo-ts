import { joinUriParts, Kms, TypedArrayEncoder } from '@credo-ts/core'
import { Oauth2ErrorCodes, Oauth2ServerErrorResponseError } from '@openid4vc/oauth2'
import { addSecondsToDate } from '@openid4vc/utils'
import type { NextFunction, Response, Router } from 'express'
import { getRequestContext, sendOauth2ErrorResponse, sendUnknownServerErrorResponse } from '../../shared/router'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import type { OpenId4VcIssuanceRequest } from './requestContext'

export function configureRedirectEndpoint(router: Router, config: OpenId4VcIssuerModuleConfig) {
  router.get(
    config.redirectEndpoint,
    async (request: OpenId4VcIssuanceRequest, response: Response, next: NextFunction) => {
      const requestContext = getRequestContext(request)
      const { agentContext, issuer } = requestContext
      const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)

      try {
        // TODO: oid4vc-ts needs method to parse authorization response / redirect url.
        const chainedIdentityAuthorizationCode = request.query.code
        const chainedIdentityState = request.query.state
        const error = request.query.error

        if (!chainedIdentityState || typeof chainedIdentityState !== 'string') {
          throw new Oauth2ServerErrorResponseError({
            // Server error because it's an error of the external IDP
            error: Oauth2ErrorCodes.ServerError,
            error_description: `Missing required 'state' parameter`,
          })
        }

        const issuanceSession = await openId4VcIssuerService.findSingleIssuanceSessionByQuery(agentContext, {
          issuerId: issuer.issuerId,
          chainedIdentityState: chainedIdentityState,
        })

        if (!issuanceSession || issuanceSession.state !== OpenId4VcIssuanceSessionState.AuthorizationInitiated) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidRequest,
              error_description: `Invalid 'state' parameter`,
            },
            {
              internalMessage: !issuanceSession
                ? `Issuance session not found for identity chaining 'state' parameter '${chainedIdentityState}'`
                : `Issuance session '${issuanceSession.id}' has state '${
                    issuanceSession.state
                  }' but expected ${OpenId4VcIssuanceSessionState.AuthorizationInitiated}`,
            }
          )
        }

        if (!issuanceSession.chainedIdentity?.required || !issuanceSession.chainedIdentity.redirectUri) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidRequest,
              error_description: 'The session is invalid or has expired.',
            },
            {
              internalMessage: `Issuance session '${issuanceSession.id}' does not have identity chaining configured, so it's not compatible with the redirect endpoint.`,
            }
          )
        }

        if (chainedIdentityAuthorizationCode && typeof chainedIdentityAuthorizationCode === 'string') {
          // TODO: should we be storing all metadata, or just the identifier of the external IDP and fetch the metadata again?
          const authorizationServerMetadata = issuanceSession.chainedIdentity.chainedIdentityServerMetadata
          if (!authorizationServerMetadata) {
            throw new Oauth2ServerErrorResponseError(
              {
                error: Oauth2ErrorCodes.ServerError,
                error_description: `Unable to retrieve authorization server metadata from external identity provider.`,
              },
              {
                internalMessage: `Missing chained identity server metadata on issuance session '${issuanceSession.id}'`,
              }
            )
          }

          const oauth2Client = openId4VcIssuerService.getOauth2Client(agentContext, issuer)

          // Retrieve / verify access token.
          // TODO: add support for DPoP
          const { accessTokenResponse } = await oauth2Client
            .retrieveAuthorizationCodeAccessToken({
              authorizationCode: chainedIdentityAuthorizationCode,
              authorizationServerMetadata,
              pkceCodeVerifier: issuanceSession.chainedIdentity.pkceCodeVerifier,

              redirectUri: joinUriParts(config.baseUrl, [issuer.issuerId, 'redirect']),
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
                  internalMessage: `Error occurred during retrieval of access token from ${authorizationServerMetadata.issuer}.`,
                  cause: error,
                }
              )
            })

          // Grant authorization
          const kms = agentContext.resolve(Kms.KeyManagementApi)
          const authorizationCode = TypedArrayEncoder.toBase64URL(kms.randomBytes({ length: 32 }))
          const authorizationCodeExpiresAt = addSecondsToDate(new Date(), config.authorizationCodeExpiresInSeconds)

          const redirectUri = new URL(issuanceSession.chainedIdentity.redirectUri)
          redirectUri.searchParams.set('code', authorizationCode)

          if (issuanceSession.chainedIdentity.state) {
            redirectUri.searchParams.set('state', issuanceSession.chainedIdentity.state)
          }

          // Update authorization information
          issuanceSession.authorization = {
            ...issuanceSession.authorization,
            code: authorizationCode,
            codeExpiresAt: authorizationCodeExpiresAt,
          }

          // Store access token response
          issuanceSession.chainedIdentity = {
            ...issuanceSession.chainedIdentity,
            accessTokenResponse,
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
          issuanceSession.errorMessage = `Error occurred during identity chaining. ${error}: ${request.query.error_description}`
          await openId4VcIssuerService.updateState(agentContext, issuanceSession, OpenId4VcIssuanceSessionState.Error)

          const redirectUri = new URL(issuanceSession.chainedIdentity.redirectUri)
          redirectUri.searchParams.set('error', Oauth2ErrorCodes.ServerError)

          // TODO: correctly map the error codes from the underlying oauth2 flow
          // redirectUri.searchParams.set('error_description')

          if (issuanceSession.chainedIdentity.state) {
            redirectUri.searchParams.set('state', issuanceSession.chainedIdentity.state)
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
