import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { AgentContext } from '@credo-ts/core'
import type { JWK, SigningAlgo } from '@sphereon/oid4vc-common'
import type { JWTSignerCallback } from '@sphereon/oid4vci-common'
import type { NextFunction, Response, Router } from 'express'

import {
  getJwkFromKey,
  CredoError,
  JwsService,
  JwtPayload,
  getJwkClassFromKeyType,
  Key,
  joinUriParts,
} from '@credo-ts/core'
import { verifyDPoP } from '@sphereon/oid4vc-common'
import { PRE_AUTH_CODE_LITERAL, TokenError, TokenErrorResponse } from '@sphereon/oid4vci-common'

import { getRequestContext, sendErrorResponse, sendJsonResponse } from '../../shared/router'
import { getVerifyJwtCallback } from '../../shared/utils'
import { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { OpenId4VcCNonceStateManager } from '../repository/OpenId4VcCNonceStateManager'
import { OpenId4VcCredentialOfferSessionStateManager } from '../repository/OpenId4VcCredentialOfferSessionStateManager'
import { assertValidAccessTokenRequest, createAccessTokenResponse } from '@sphereon/oid4vci-issuer'
import { OpenId4VcIssuanceSessionRepository } from '../repository'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'

export interface OpenId4VciAccessTokenEndpointConfig {
  /**
   * The path at which the token endpoint should be made available. Note that it will be
   * hosted at a subpath to take into account multiple tenants and issuers.
   *
   * @default /token
   */
  endpointPath: string

  /**
   * The maximum amount of time in seconds that the pre-authorized code is valid.
   * @default 360 (5 minutes)
   */
  preAuthorizedCodeExpirationInSeconds: number

  /**
   * The time after which the cNonce from the access token response will
   * expire.
   *
   * @default 360 (5 minutes)
   *
   * @todo move to general config (not endpoint specific)
   */
  cNonceExpiresInSeconds: number

  /**
   * The time after which the token will expire.
   *
   * @default 360 (5 minutes)
   */
  tokenExpiresInSeconds: number
}

export function configureAccessTokenEndpoint(router: Router, config: OpenId4VciAccessTokenEndpointConfig) {
  router.post(config.endpointPath, verifyTokenRequest(config), handleTokenRequest(config))
}

function getJwtSignerCallback(
  agentContext: AgentContext,
  signerPublicKey: Key,
  config: OpenId4VciAccessTokenEndpointConfig
): JWTSignerCallback {
  return async (jwt, _kid) => {
    if (_kid) {
      throw new CredoError('Kid should not be supplied externally.')
    }
    if (jwt.header.kid || jwt.header.jwk) {
      throw new CredoError('kid or jwk should not be present in access token header before signing')
    }

    const jwsService = agentContext.dependencyManager.resolve(JwsService)

    const alg = getJwkClassFromKeyType(signerPublicKey.keyType)?.supportedSignatureAlgorithms[0]
    if (!alg) {
      throw new CredoError(`No supported signature algorithms for key type: ${signerPublicKey.keyType}`)
    }

    // FIXME: the iat and exp implementation in OID4VCI is incorrect so we override the values here
    // https://github.com/Sphereon-Opensource/OID4VCI/pull/99
    // https://github.com/Sphereon-Opensource/OID4VCI/pull/101
    const iat = Math.floor(new Date().getTime() / 1000)
    jwt.payload.iat = iat
    jwt.payload.exp = iat + config.tokenExpiresInSeconds

    const jwk = getJwkFromKey(signerPublicKey)
    const signedJwt = await jwsService.createJwsCompact(agentContext, {
      protectedHeaderOptions: { ...jwt.header, jwk, alg },
      payload: JwtPayload.fromJson(jwt.payload),
      key: signerPublicKey,
    })

    return signedJwt
  }
}

export function handleTokenRequest(config: OpenId4VciAccessTokenEndpointConfig) {
  const { tokenExpiresInSeconds, cNonceExpiresInSeconds } = config

  return async (request: OpenId4VcIssuanceRequest, response: Response, next: NextFunction) => {
    response.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' })

    const requestContext = getRequestContext(request)
    const { agentContext, issuer } = requestContext

    const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
    const issuerMetadata = openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
    const accessTokenSigningKey = Key.fromFingerprint(issuer.accessTokenPublicKeyFingerprint)

    let dpopJwk: JWK | undefined
    if (request.headers.dpop) {
      try {
        const issuerConfig = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)

        const fullUrl = joinUriParts(issuerConfig.baseUrl, [requestContext.issuer.issuerId, request.url])
        dpopJwk = await verifyDPoP(
          { method: request.method, headers: request.headers, fullUrl },
          {
            jwtVerifyCallback: getVerifyJwtCallback(agentContext),
            expectAccessToken: false,
            maxIatAgeInSeconds: undefined,
            acceptedAlgorithms: issuerMetadata.dpopSigningAlgValuesSupported as SigningAlgo[] | undefined,
          }
        )
      } catch (error) {
        return sendErrorResponse(
          response,
          next,
          agentContext.config.logger,
          400,
          TokenErrorResponse.invalid_dpop_proof,
          error instanceof Error ? error.message : 'Unknown error'
        )
      }
    }

    try {
      const accessTokenResponse = await createAccessTokenResponse(request.body, {
        credentialOfferSessions: new OpenId4VcCredentialOfferSessionStateManager(agentContext, issuer.issuerId),
        tokenExpiresIn: tokenExpiresInSeconds,
        accessTokenIssuer: issuerMetadata.issuerUrl,
        cNonce: await agentContext.wallet.generateNonce(),
        cNonceExpiresIn: cNonceExpiresInSeconds,
        cNonces: new OpenId4VcCNonceStateManager(agentContext, issuer.issuerId),
        accessTokenSignerCallback: getJwtSignerCallback(agentContext, accessTokenSigningKey, config),
        dPoPJwk: dpopJwk,
      })

      return sendJsonResponse(response, next, accessTokenResponse)
    } catch (error) {
      return sendErrorResponse(
        response,
        next,
        agentContext.config.logger,
        400,
        TokenErrorResponse.invalid_request,
        error
      )
    }
  }
}

export function verifyTokenRequest(options: { preAuthorizedCodeExpirationInSeconds: number }) {
  return async (request: OpenId4VcIssuanceRequest, response: Response, next: NextFunction) => {
    const { agentContext, issuer } = getRequestContext(request)

    try {
      const credentialOfferSessions = new OpenId4VcCredentialOfferSessionStateManager(agentContext, issuer.issuerId)

      const preAuthorizedCode = request.body[PRE_AUTH_CODE_LITERAL]
      if (!preAuthorizedCode || typeof preAuthorizedCode !== 'string') {
        throw new TokenError(
          400,
          TokenErrorResponse.invalid_request,
          `Missing '${PRE_AUTH_CODE_LITERAL}' parameter in access token request body`
        )
      }
      const issuanceSessionRepository = agentContext.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
      const openId4VcIssuanceSession = await issuanceSessionRepository.getSingleByQuery(agentContext, {
        preAuthorizedCode,
        issuerId: issuer.issuerId,
      })

      if (
        ![OpenId4VcIssuanceSessionState.OfferCreated, OpenId4VcIssuanceSessionState.OfferUriRetrieved].includes(
          openId4VcIssuanceSession.state
        )
      ) {
        throw new TokenError(400, TokenErrorResponse.invalid_request, 'Access token has already been retrieved')
      }

      await assertValidAccessTokenRequest(request.body, {
        expirationDuration: options.preAuthorizedCodeExpirationInSeconds,
        credentialOfferSessions,
      })

      next()
    } catch (error) {
      if (error instanceof TokenError) {
        return sendErrorResponse(
          response,
          next,
          agentContext.config.logger,
          error.statusCode,
          error.responseError,
          error.getDescription()
        )
      } else {
        return sendErrorResponse(
          response,
          next,
          agentContext.config.logger,
          400,
          TokenErrorResponse.invalid_request,
          error
        )
      }
    }
  }
}
