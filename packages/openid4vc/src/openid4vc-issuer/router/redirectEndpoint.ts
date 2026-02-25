import { joinUriParts, Kms, TypedArrayEncoder } from '@credo-ts/core'
import {
  Oauth2ClientErrorResponseError,
  Oauth2ErrorCodes,
  Oauth2ServerErrorResponseError,
  verifyIdTokenJwt,
} from '@openid4vc/oauth2'
import { addSecondsToDate } from '@openid4vc/utils'
import type { NextFunction, Response, Router } from 'express'
import { getOid4vcCallbacks } from '../../shared'
import { getRequestContext, sendOauth2ErrorResponse, sendUnknownServerErrorResponse } from '../../shared/router'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import type { OpenId4VcIssuanceSessionRecord } from '../repository'
import type { OpenId4VcIssuanceRequest } from './requestContext'

export function configureRedirectEndpoint(router: Router, config: OpenId4VcIssuerModuleConfig) {
  router.get(
    config.redirectEndpoint,
    async (request: OpenId4VcIssuanceRequest, response: Response, next: NextFunction) => {
      const requestContext = getRequestContext(request)
      const { agentContext, issuer } = requestContext
      const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
      const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
      const oauth2Client = openId4VcIssuerService.getOauth2Client(agentContext, issuer)
      const authorizationServerIssuer = issuerMetadata.authorizationServers[0].issuer

      let issuanceSession: OpenId4VcIssuanceSessionRecord | null = null
      try {
        const fullRequestUrl = joinUriParts(issuerMetadata.credentialIssuer.credential_issuer, [request.originalUrl])

        const authorizationResponse = oauth2Client.parseAuthorizationResponseRedirectUrl({
          url: fullRequestUrl,
        })

        if (!authorizationResponse.state) {
          throw new Oauth2ServerErrorResponseError({
            // Server error because it's an error of the external IDP
            error: Oauth2ErrorCodes.ServerError,
            error_description: `Missing required 'state' parameter`,
          })
        }

        issuanceSession = await openId4VcIssuerService.findSingleIssuanceSessionByQuery(agentContext, {
          issuerId: issuer.issuerId,
          chainedIdentityState: authorizationResponse.state,
        })

        if (!issuanceSession || issuanceSession.state !== OpenId4VcIssuanceSessionState.AuthorizationInitiated) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidRequest,
              error_description: `Invalid 'state' parameter`,
            },
            {
              internalMessage: !issuanceSession
                ? `Issuance session not found for identity chaining 'state' parameter '${authorizationResponse.state}'`
                : `Issuance session '${issuanceSession.id}' has state '${
                    issuanceSession.state
                  }' but expected ${OpenId4VcIssuanceSessionState.AuthorizationInitiated}`,
            }
          )
        }

        if (
          !issuanceSession.chainedIdentity?.externalAuthorizationServerUrl ||
          !issuanceSession.chainedIdentity?.externalAuthorizationServerMetadata ||
          !issuanceSession.chainedIdentity.redirectUri
        ) {
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

        oauth2Client.verifyAuthorizationResponse({
          authorizationResponse,
          authorizationServerMetadata: issuanceSession.chainedIdentity.externalAuthorizationServerMetadata,
        })

        // Throw the error. This will be caught and processed below.
        if (authorizationResponse.error) {
          throw new Oauth2ServerErrorResponseError(authorizationResponse)
        }

        if (!authorizationResponse.code) {
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.ServerError,
            error_description: `Missing required 'error' or 'code' parameter`,
          })
        }

        const authorizationServerUrl = issuanceSession.chainedIdentity.externalAuthorizationServerUrl
        const authorizationServerConfig = issuer.chainedAuthorizationServerConfigs?.find(
          (config) => config.issuer === authorizationServerUrl
        )
        if (!authorizationServerConfig) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.ServerError,
            },
            {
              internalMessage: `Issuer '${issuer.issuerId}' does not have a chained authorization server config for issuer '${authorizationServerUrl}'`,
            }
          )
        }

        const authorizationServerMetadata = await oauth2Client.fetchAuthorizationServerMetadata(
          authorizationServerConfig.issuer
        )
        if (!authorizationServerMetadata) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.ServerError,
              error_description: `Unable to retrieve authorization server metadata from external identity provider.`,
            },
            {
              internalMessage: `Unable to retrieve authorization server metadata from '${authorizationServerConfig.issuer}'`,
            }
          )
        }

        // Retrieve access token
        // TODO: add support for DPoP
        const { accessTokenResponse } = await oauth2Client
          .retrieveAuthorizationCodeAccessToken({
            authorizationCode: authorizationResponse.code,
            authorizationServerMetadata,
            pkceCodeVerifier: issuanceSession.chainedIdentity.pkceCodeVerifier,
            redirectUri: joinUriParts(config.baseUrl, [issuer.issuerId, 'redirect']),
          })
          .catch((error) => {
            if (error instanceof Oauth2ClientErrorResponseError) {
              switch (error.errorResponse.error) {
                case Oauth2ErrorCodes.InvalidGrant:
                  throw new Oauth2ServerErrorResponseError(
                    {
                      error: Oauth2ErrorCodes.InvalidGrant,
                    },
                    {
                      internalMessage: `Invalid authorization code received from '${authorizationServerMetadata.issuer}'.`,
                      cause: error,
                    }
                  )
                case Oauth2ErrorCodes.AccessDenied:
                  throw new Oauth2ServerErrorResponseError(
                    {
                      error: Oauth2ErrorCodes.AccessDenied,
                    },
                    {
                      internalMessage: `The request has been denied by the user at '${authorizationServerMetadata.issuer}'.`,
                      cause: error,
                    }
                  )
              }
            }

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

        // Verify the ID Token if 'openid' scope was requested
        if (accessTokenResponse.scope?.split(' ').includes('openid')) {
          const idToken = accessTokenResponse.id_token
          if (typeof idToken !== 'string') {
            throw new Oauth2ServerErrorResponseError(
              {
                error: Oauth2ErrorCodes.ServerError,
                error_description: `Missing 'id_token' in access token response`,
              },
              {
                internalMessage: `id_token is missing from access token response from ${authorizationServerMetadata.issuer} even though 'openid' scope was requested.`,
              }
            )
          }

          await verifyIdTokenJwt({
            idToken,
            authorizationServer: authorizationServerMetadata,
            clientId: authorizationServerConfig.clientAuthentication.clientId,
            callbacks: getOid4vcCallbacks(agentContext),
          })
        }

        // Grant authorization
        const kms = agentContext.resolve(Kms.KeyManagementApi)
        const authorizationCode = TypedArrayEncoder.toBase64URL(kms.randomBytes({ length: 32 }))
        const authorizationCodeExpiresAt = addSecondsToDate(new Date(), config.authorizationCodeExpiresInSeconds)

        const redirectUri = new URL(issuanceSession.chainedIdentity.redirectUri)

        // First authorization server is the internal authorization server (always used with chained authorization)
        redirectUri.searchParams.set('iss', authorizationServerIssuer)
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
          externalAccessTokenResponse: accessTokenResponse,
        }

        // TODO: we need to start using locks so we can't get corrupted state
        await openId4VcIssuerService.updateState(
          agentContext,
          issuanceSession,
          OpenId4VcIssuanceSessionState.AuthorizationGranted
        )

        return response.redirect(redirectUri.toString())
      } catch (error) {
        if (error instanceof Oauth2ServerErrorResponseError) {
          // Redirect to the redirect URI if available.
          if (issuanceSession?.chainedIdentity?.redirectUri) {
            const redirectUri = new URL(issuanceSession.chainedIdentity.redirectUri)
            redirectUri.searchParams.set('error', error.errorResponse.error)
            redirectUri.searchParams.set('iss', authorizationServerIssuer)
            if (error.errorResponse.error_description) {
              redirectUri.searchParams.set('error_description', error.errorResponse.error_description)
            }
            if (issuanceSession.chainedIdentity.state) {
              redirectUri.searchParams.set('state', issuanceSession.chainedIdentity.state)
            }

            agentContext.config.logger.warn(
              `[OID4VC] Sending oauth2 error response: ${JSON.stringify(error.message)}`,
              {
                error,
              }
            )

            return response.redirect(redirectUri.toString())
          }

          return sendOauth2ErrorResponse(response, next, agentContext.config.logger, error)
        }

        return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error)
      }
    }
  )
}
