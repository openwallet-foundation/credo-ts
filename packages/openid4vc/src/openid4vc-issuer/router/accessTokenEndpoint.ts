import { CredoError, joinUriParts, type Query, utils } from '@credo-ts/core'
import type { HttpMethod, Jwk, VerifyAccessTokenRequestReturn } from '@openid4vc/oauth2'
import {
  authorizationCodeGrantIdentifier,
  decodeJwt,
  Oauth2ErrorCodes,
  Oauth2ServerErrorResponseError,
  preAuthorizedCodeGrantIdentifier,
  refreshTokenGrantIdentifier,
} from '@openid4vc/oauth2'
import type { NextFunction, Response, Router } from 'express'
import {
  getRequestContext,
  sendJsonResponse,
  sendOauth2ErrorResponse,
  sendUnknownServerErrorResponse,
} from '../../shared/router'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import type { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { OpenId4VcIssuanceSessionRecord, OpenId4VcIssuanceSessionRepository } from '../repository'
import type { OpenId4VcIssuanceRequest } from './requestContext'

// draft 09 §6.1 response header carrying a fresh client attestation challenge. The oid4vc-ts library
// does not export this constant, so it is defined locally.
const oauthClientAttestationChallengeHeader = 'OAuth-Client-Attestation-Challenge'

export function configureAccessTokenEndpoint(router: Router, config: OpenId4VcIssuerModuleConfig) {
  router.post(config.accessTokenEndpointPath, handleTokenRequest(config))
}

export function handleTokenRequest(config: OpenId4VcIssuerModuleConfig) {
  return async (request: OpenId4VcIssuanceRequest, response: Response, next: NextFunction) => {
    response.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' })
    const requestContext = getRequestContext(request)
    const { agentContext, issuer } = requestContext

    try {
      const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
      const issuanceSessionRepository = agentContext.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
      const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
      const accessTokenSigningKey = issuer.resolvedAccessTokenPublicJwk
      let oauth2AuthorizationServer = openId4VcIssuerService.getOauth2AuthorizationServer(agentContext)

      const fullRequestUrl = joinUriParts(issuerMetadata.credentialIssuer.credential_issuer, [
        config.accessTokenEndpointPath,
      ])
      const requestLike = {
        headers: new Headers(request.headers as Record<string, string>),
        method: request.method as HttpMethod,
        url: fullRequestUrl,
      } as const

      const { accessTokenRequest, grant, dpop, clientAttestation, pkceCodeVerifier } =
        oauth2AuthorizationServer.parseAccessTokenRequest({
          accessTokenRequest: request.body,
          request: requestLike,
        })

      let allowedStates: OpenId4VcIssuanceSessionState[]
      let query: Query<OpenId4VcIssuanceSessionRecord>
      let parsedRefreshToken: ReturnType<OpenId4VcIssuerService['parseRefreshToken']> | undefined

      switch (grant.grantType) {
        case preAuthorizedCodeGrantIdentifier:
          allowedStates = [OpenId4VcIssuanceSessionState.OfferCreated, OpenId4VcIssuanceSessionState.OfferUriRetrieved]
          query = { preAuthorizedCode: grant.preAuthorizedCode }
          break
        case authorizationCodeGrantIdentifier:
          allowedStates = [OpenId4VcIssuanceSessionState.AuthorizationGranted]
          query = { authorizationCode: grant.code }
          break
        case refreshTokenGrantIdentifier:
          allowedStates = [
            OpenId4VcIssuanceSessionState.CredentialRequestReceived,
            OpenId4VcIssuanceSessionState.CredentialsPartiallyIssued,
          ]
          parsedRefreshToken = openId4VcIssuerService.parseRefreshToken(agentContext, grant.refreshToken)
          query = {
            preAuthorizedCode: parsedRefreshToken.preAuthorizedCode,
            issuerState: parsedRefreshToken.issuerState,
          }
          break
        default:
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.UnsupportedGrantType,
            error_description: 'Unsupported grant type',
          })
      }

      const issuanceSession = await issuanceSessionRepository.findSingleByQuery(agentContext, query)
      if (!issuanceSession || !allowedStates.includes(issuanceSession.state)) {
        throw new Oauth2ServerErrorResponseError({
          error: Oauth2ErrorCodes.InvalidGrant,
          error_description: 'Invalid authorization code',
        })
      }

      const expiresAt =
        issuanceSession.expiresAt ??
        utils.addSecondsToDate(issuanceSession.createdAt, config.statefulCredentialOfferExpirationInSeconds)

      if (Date.now() > expiresAt.getTime()) {
        issuanceSession.errorMessage = 'Credential offer has expired'
        await openId4VcIssuerService.updateState(agentContext, issuanceSession, OpenId4VcIssuanceSessionState.Error)
        throw new Oauth2ServerErrorResponseError({
          // What is the best error here?
          error: Oauth2ErrorCodes.InvalidGrant,
          error_description: 'Session expired',
        })
      }

      oauth2AuthorizationServer = openId4VcIssuerService.getOauth2AuthorizationServer(agentContext, { issuanceSession })
      let verificationResult: VerifyAccessTokenRequestReturn

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
          authorizationServerMetadata: issuerMetadata.authorizationServers[0],
          clientAttestation: {
            ...clientAttestation,
            // First session config, fall back to global config
            required: issuanceSession.walletAttestation?.required ?? config.walletAttestationsRequired,

            // NOTE: we might want to enforce this? Not sure
            // ensureConfirmationKeyMatchesDpopKey: true
          },
          dpop: {
            ...dpop,
            // First session config, fall back to global config
            required: issuanceSession.dpop?.required ?? config.dpopRequired,
          },
          expectedTxCode: issuanceSession.userPin,
          preAuthorizedCodeExpiresAt:
            issuanceSession.expiresAt ??
            utils.addSecondsToDate(issuanceSession.createdAt, config.statefulCredentialOfferExpirationInSeconds),
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
          authorizationServerMetadata: issuerMetadata.authorizationServers[0],
          request: requestLike,
          clientAttestation: {
            ...clientAttestation,

            // Ensure it matches the previously provided client id
            // FIXME: we don't verify that the attestation is issued by the same party
            expectedClientId: issuanceSession.clientId,

            // NOTE: we don't look at the global config here. As we already checked and
            // set required to true previously if client attestations were provided or required.
            required: issuanceSession.walletAttestation?.required,

            // NOTE: we might want to enforce this? Not sure
            // ensureConfirmationKeyMatchesDpopKey: true
          },
          dpop: {
            ...dpop,
            // NOTE: we don't look at the global config here. As we already checked and
            // set required to true previously if client attestations were provided or required.
            required: issuanceSession.dpop?.required,

            // Ensure it matches previously provided jwk thumbprint
            expectedJwkThumbprint: issuanceSession.dpop?.dpopJkt,
          },
          pkce: issuanceSession.pkce
            ? {
                codeChallenge: issuanceSession.pkce.codeChallenge,
                codeChallengeMethod: issuanceSession.pkce.codeChallengeMethod,
                codeVerifier: pkceCodeVerifier,
              }
            : undefined,
        })
      } else if (grant.grantType === refreshTokenGrantIdentifier) {
        if (!parsedRefreshToken) {
          throw new CredoError('Refresh token verification is required for refresh token grant type')
        }

        verificationResult = await oauth2AuthorizationServer.verifyRefreshTokenAccessTokenRequest({
          accessTokenRequest,
          // Refresh token validity is already checked before
          expectedRefreshToken: grant.refreshToken,
          grant,
          request: requestLike,
          authorizationServerMetadata: issuerMetadata.authorizationServers[0],
          clientAttestation: {
            ...clientAttestation,
            // First session config, fall back to global config
            required: issuanceSession.walletAttestation?.required ?? config.walletAttestationsRequired,

            // NOTE: we might want to enforce this? Not sure
            // ensureConfirmationKeyMatchesDpopKey: true
          },
          dpop: {
            ...dpop,
            // First session config, fall back to global config
            required: issuanceSession.dpop?.required ?? config.dpopRequired,
          },
          refreshTokenExpiresAt: parsedRefreshToken?.expiresAt,
        })

        await openId4VcIssuerService.verifyRefreshToken(agentContext, issuer, parsedRefreshToken, {
          dpop: verificationResult.dpop,
        })
      } else {
        throw new Oauth2ServerErrorResponseError({
          error: Oauth2ErrorCodes.UnsupportedGrantType,
          error_description: 'Unsupported grant type',
        })
      }

      // Client Attestation PoP challenge (draft 09). A provided challenge is always validated; the reactive
      // `use_attestation_challenge` flow (mint a fresh challenge, return it in the
      // `OAuth-Client-Attestation-Challenge` header, client retries) is only used when the challenge is
      // required. A provided-but-invalid challenge is rejected even when not required.
      if (verificationResult.clientAttestation) {
        // The method is discriminated by the presence of the client attestation pop jwt (draft 09 §7.3):
        // the standard method has a pop jwt (challenge in its `challenge` claim); the DPoP-bound method
        // (`attest_jwt_client_auth_dpop`) has no pop jwt and carries the challenge in the `nonce` claim of
        // the single DPoP proof. A standard-method pop without a challenge stays undefined here (it must
        // not read a standalone DPoP nonce).
        const { clientAttestationPop } = verificationResult.clientAttestation
        let popChallenge: string | undefined
        if (clientAttestationPop) {
          popChallenge = clientAttestationPop.payload.challenge
        } else if (verificationResult.dpop) {
          const dpopJwt = requestLike.headers.get('DPoP')
          const dpopNonce = dpopJwt ? decodeJwt({ jwt: dpopJwt }).payload.nonce : undefined
          popChallenge = typeof dpopNonce === 'string' ? dpopNonce : undefined
        }

        const isValid = await openId4VcIssuerService.isClientAttestationPopChallengeValid(
          agentContext,
          issuer,
          popChallenge
        )

        if (!isValid) {
          if (config.clientAttestationPopChallengeRequired) {
            const { challenge } = await openId4VcIssuerService.createClientAttestationChallenge(agentContext, issuer)
            response.set(oauthClientAttestationChallengeHeader, challenge)
            throw new Oauth2ServerErrorResponseError({
              error: Oauth2ErrorCodes.UseAttestationChallenge,
              error_description: 'A fresh client attestation challenge is required in the client attestation pop jwt.',
            })
          }

          // Not required: a missing challenge is fine, but a provided-but-invalid challenge is rejected.
          if (popChallenge !== undefined) {
            throw new Oauth2ServerErrorResponseError({
              error: Oauth2ErrorCodes.InvalidClient,
              error_description: `Invalid 'challenge' claim in client attestation pop jwt.`,
            })
          }
        }
      }

      // Do not update the session state if the grant type is refresh token. This
      // avoids the session state going "backwards".
      if (grant.grantType !== refreshTokenGrantIdentifier) {
        await openId4VcIssuerService.updateState(
          agentContext,
          issuanceSession,
          OpenId4VcIssuanceSessionState.AccessTokenRequested
        )
      }

      const { cNonce, cNonceExpiresInSeconds } = await openId4VcIssuerService.createNonce(agentContext, issuer)

      // for authorization code flow we take the authorization scopes. For pre-auth we don't use scopes (we just
      // use the offered credential configuration ids so a scope is not required)
      const scopes =
        grant.grantType === authorizationCodeGrantIdentifier ? issuanceSession.authorization?.scopes : undefined
      const subject = `credo:${utils.uuid()}`

      const tokenDpop = verificationResult.dpop
        ? {
            jwk: verificationResult.dpop?.jwk,
          }
        : undefined

      // Generate a refresh token if they're enabled in the config and the grant type is not refresh token
      let refreshToken: string | undefined
      if (issuanceSession.generateRefreshTokens && grant.grantType !== refreshTokenGrantIdentifier) {
        refreshToken = await openId4VcIssuerService.createRefreshToken(agentContext, issuer, {
          preAuthorizedCode: grant.grantType === preAuthorizedCodeGrantIdentifier ? grant.preAuthorizedCode : undefined,
          issuerState: issuanceSession.authorization?.issuerState,
          dpop: tokenDpop,
        })
      }

      const signerJwk = accessTokenSigningKey
      const accessTokenResponse = await oauth2AuthorizationServer.createAccessTokenResponse({
        audience: issuerMetadata.credentialIssuer.credential_issuer,
        authorizationServer: issuerMetadata.credentialIssuer.credential_issuer,
        expiresInSeconds: config.accessTokenExpiresInSeconds,
        signer: {
          method: 'jwk',
          alg: signerJwk.supportedSignatureAlgorithms[0],
          publicJwk: signerJwk.toJson() as Jwk,
        },
        dpop: tokenDpop,
        scope: scopes?.join(' '),
        clientId: issuanceSession.clientId,

        additionalAccessTokenPayload: {
          'pre-authorized_code':
            grant.grantType === preAuthorizedCodeGrantIdentifier
              ? grant.preAuthorizedCode
              : parsedRefreshToken?.preAuthorizedCode,
          issuer_state: issuanceSession.authorization?.issuerState,
        },
        // We generate a random subject for each access token and bind the issuance session to this.
        subject,

        refreshToken,

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
        // Retain the current session state when refreshing the access token.
        grant.grantType === refreshTokenGrantIdentifier
          ? issuanceSession.state
          : OpenId4VcIssuanceSessionState.AccessTokenCreated
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
