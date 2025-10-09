import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import type { HttpMethod, VerifyAccessTokenRequestReturn } from '@animo-id/oauth2'
import type { NextFunction, Response, Router } from 'express'

import {
  authorizationCodeGrantIdentifier,
  Oauth2ErrorCodes,
  Oauth2ServerErrorResponseError,
  preAuthorizedCodeGrantIdentifier,
} from '@animo-id/oauth2'
import { getJwkFromKey, joinUriParts, Key, utils } from '@credo-ts/core'

import {
  getRequestContext,
  sendJsonResponse,
  sendOauth2ErrorResponse,
  sendUnknownServerErrorResponse,
} from '../../shared/router'
import { addSecondsToDate } from '../../shared/utils'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { OpenId4VcIssuanceSessionRepository } from '../repository'

export function configureAccessTokenEndpoint(router: Router, config: OpenId4VcIssuerModuleConfig) {
  router.post(config.accessTokenEndpointPath, handleTokenRequest(config))
}

export function handleTokenRequest(config: OpenId4VcIssuerModuleConfig) {
  return async (request: OpenId4VcIssuanceRequest, response: Response, next: NextFunction) => {
    response.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' })
    const requestContext = getRequestContext(request)
    const { agentContext, issuer } = requestContext

    const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
    const issuanceSessionRepository = agentContext.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
    const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
    const accessTokenSigningKey = Key.fromFingerprint(issuer.accessTokenPublicKeyFingerprint)
    const oauth2AuthorizationServer = openId4VcIssuerService.getOauth2AuthorizationServer(agentContext)

    const fullRequestUrl = joinUriParts(issuerMetadata.credentialIssuer.credential_issuer, [
      config.accessTokenEndpointPath,
    ])
    const requestLike = {
      headers: new Headers(request.headers as Record<string, string>),
      method: request.method as HttpMethod,
      url: fullRequestUrl,
    } as const

    const { accessTokenRequest, grant, dpopJwt, pkceCodeVerifier } = oauth2AuthorizationServer.parseAccessTokenRequest({
      accessTokenRequest: request.body,
      request: requestLike,
    })

    const issuanceSession = await issuanceSessionRepository.findSingleByQuery(agentContext, {
      preAuthorizedCode: grant.grantType === preAuthorizedCodeGrantIdentifier ? grant.preAuthorizedCode : undefined,
      authorizationCode: grant.grantType === authorizationCodeGrantIdentifier ? grant.code : undefined,
    })
    const allowedStates =
      grant.grantType === preAuthorizedCodeGrantIdentifier
        ? [OpenId4VcIssuanceSessionState.OfferCreated, OpenId4VcIssuanceSessionState.OfferUriRetrieved]
        : [OpenId4VcIssuanceSessionState.AuthorizationGranted]
    if (!issuanceSession || !allowedStates.includes(issuanceSession.state)) {
      throw new Oauth2ServerErrorResponseError({
        error: Oauth2ErrorCodes.InvalidGrant,
        error_description: 'Invalid authorization code',
      })
    }

    if (
      Date.now() >
      addSecondsToDate(issuanceSession.createdAt, config.statefullCredentialOfferExpirationInSeconds).getTime()
    ) {
      issuanceSession.errorMessage = 'Credential offer has expired'
      await openId4VcIssuerService.updateState(agentContext, issuanceSession, OpenId4VcIssuanceSessionState.Error)
      throw new Oauth2ServerErrorResponseError({
        // What is the best error here?
        error: Oauth2ErrorCodes.InvalidGrant,
        error_description: 'Session expired',
      })
    }

    let verificationResult: VerifyAccessTokenRequestReturn
    try {
      if (grant.grantType === preAuthorizedCodeGrantIdentifier) {
        if (!issuanceSession.preAuthorizedCode) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidGrant,
              error_description: 'Invalid authorization code',
            },
            {
              internalMessage:
                'Found issuance session without preAuthorizedCode. This should not happen as the issuance session is fetched based on the pre authorized code',
            }
          )
        }

        verificationResult = await oauth2AuthorizationServer.verifyPreAuthorizedCodeAccessTokenRequest({
          accessTokenRequest,
          expectedPreAuthorizedCode: issuanceSession.preAuthorizedCode,
          grant,
          request: requestLike,
          dpop: {
            jwt: dpopJwt,
            // This will only have effect when DPoP is not present.
            // If it is present it will always be verified
            required: config.dpopRequired,
          },
          expectedTxCode: issuanceSession.userPin,
          preAuthorizedCodeExpiresAt: addSecondsToDate(
            issuanceSession.createdAt,
            config.statefullCredentialOfferExpirationInSeconds
          ),
        })
      } else if (grant.grantType === authorizationCodeGrantIdentifier) {
        if (!issuanceSession.authorization?.code || !issuanceSession.authorization?.codeExpiresAt) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidGrant,
              error_description: 'Invalid authorization code',
            },
            {
              internalMessage:
                'Found issuance session without authorization.code or authorization.codeExpiresAt. This should not happen as the issuance session is fetched based on the authorization code',
            }
          )
        }
        verificationResult = await oauth2AuthorizationServer.verifyAuthorizationCodeAccessTokenRequest({
          accessTokenRequest,
          expectedCode: issuanceSession.authorization.code,
          codeExpiresAt: issuanceSession.authorization.codeExpiresAt,
          grant,
          request: requestLike,
          dpop: {
            jwt: dpopJwt,
            // This will only have effect when DPoP is not present.
            // If it is present it will always be verified
            required: config.dpopRequired,
          },
          pkce: issuanceSession.pkce
            ? {
                codeChallenge: issuanceSession.pkce.codeChallenge,
                codeChallengeMethod: issuanceSession.pkce.codeChallengeMethod,
                codeVerifier: pkceCodeVerifier,
              }
            : undefined,
        })
      } else {
        throw new Oauth2ServerErrorResponseError({
          error: Oauth2ErrorCodes.UnsupportedGrantType,
          error_description: 'Unsupported grant type',
        })
      }

      await openId4VcIssuerService.updateState(
        agentContext,
        issuanceSession,
        OpenId4VcIssuanceSessionState.AccessTokenRequested
      )
      const { cNonce, cNonceExpiresInSeconds } = await openId4VcIssuerService.createNonce(agentContext, issuer)

      // for authorization code flow we take the authorization scopes. For pre-auth we don't use scopes (we just
      // use the offered credential configuration ids so a scope is not required)
      const scopes =
        grant.grantType === authorizationCodeGrantIdentifier ? issuanceSession.authorization?.scopes : undefined
      const subject = `credo:${utils.uuid()}`

      const signerJwk = getJwkFromKey(accessTokenSigningKey)
      const accessTokenResponse = await oauth2AuthorizationServer.createAccessTokenResponse({
        audience: issuerMetadata.credentialIssuer.credential_issuer,
        authorizationServer: issuerMetadata.credentialIssuer.credential_issuer,
        expiresInSeconds: config.accessTokenExpiresInSeconds,
        signer: {
          method: 'jwk',
          alg: signerJwk.supportedSignatureAlgorithms[0],
          publicJwk: signerJwk.toJson(),
        },
        dpopJwk: verificationResult.dpopJwk,
        scope: scopes?.join(' '),
        clientId: issuanceSession.clientId,

        additionalAccessTokenPayload: {
          'pre-authorized_code':
            grant.grantType === preAuthorizedCodeGrantIdentifier ? grant.preAuthorizedCode : undefined,
          issuer_state: issuanceSession.authorization?.issuerState,
        },
        // We generate a random subject for each access token and bind the issuance session to this.
        subject,

        // NOTE: these have been removed in newer drafts. Keeping them in for now
        cNonce,
        cNonceExpiresIn: cNonceExpiresInSeconds,
      })

      issuanceSession.authorization = {
        ...issuanceSession.authorization,
        subject,
      }
      await openId4VcIssuerService.updateState(
        agentContext,
        issuanceSession,
        OpenId4VcIssuanceSessionState.AccessTokenCreated
      )

      return sendJsonResponse(response, next, accessTokenResponse)
    } catch (error) {
      if (error instanceof Oauth2ServerErrorResponseError) {
        return sendOauth2ErrorResponse(response, next, agentContext.config.logger, error)
      }

      return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error)
    }
  }
}
