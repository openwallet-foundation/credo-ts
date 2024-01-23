import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { AgentContext } from '@aries-framework/core'
import type { JWTSignerCallback } from '@sphereon/oid4vci-common'
import type { NextFunction, Response, Router } from 'express'

import {
  getJwkFromKey,
  AriesFrameworkError,
  JwsService,
  JwtPayload,
  getJwkClassFromKeyType,
  Key,
} from '@aries-framework/core'
import {
  GrantTypes,
  PRE_AUTHORIZED_CODE_REQUIRED_ERROR,
  TokenError,
  TokenErrorResponse,
} from '@sphereon/oid4vci-common'
import { assertValidAccessTokenRequest, createAccessTokenResponse } from '@sphereon/oid4vci-issuer'

import { getRequestContext, sendErrorResponse } from '../../shared/router'
import { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

export interface AccessTokenEndpointConfig {
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
   */
  cNonceExpiresInSeconds: number

  /**
   * The time after which the token will expire.
   *
   * @default 360 (5 minutes)
   */
  tokenExpiresInSeconds: number
}

export function configureAccessTokenEndpoint(router: Router, config: AccessTokenEndpointConfig) {
  router.post(
    config.endpointPath,
    verifyTokenRequest({ preAuthorizedCodeExpirationInSeconds: config.preAuthorizedCodeExpirationInSeconds }),
    handleTokenRequest(config)
  )
}

function getJwtSignerCallback(agentContext: AgentContext, signerPublicKey: Key): JWTSignerCallback {
  return async (jwt, _kid) => {
    if (_kid) {
      throw new AriesFrameworkError('Kid should not be supplied externally.')
    }
    if (jwt.header.kid || jwt.header.jwk) {
      throw new AriesFrameworkError('kid or jwk should not be present in access token header before signing')
    }

    const jwsService = agentContext.dependencyManager.resolve(JwsService)

    const alg = getJwkClassFromKeyType(signerPublicKey.keyType)?.supportedSignatureAlgorithms[0]
    if (!alg) {
      throw new AriesFrameworkError(`No supported signature algorithms for key type: ${signerPublicKey.keyType}`)
    }

    const jwk = getJwkFromKey(signerPublicKey)
    const signedJwt = await jwsService.createJwsCompact(agentContext, {
      protectedHeaderOptions: { ...jwt.header, jwk, alg },
      payload: new JwtPayload(jwt.payload),
      key: signerPublicKey,
    })

    return signedJwt
  }
}

export function handleTokenRequest(config: AccessTokenEndpointConfig) {
  const { tokenExpiresInSeconds, cNonceExpiresInSeconds } = config

  return async (request: OpenId4VcIssuanceRequest, response: Response, next: NextFunction) => {
    response.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' })

    const requestContext = getRequestContext(request)
    const { agentContext, issuer } = requestContext

    if (request.body.grant_type !== GrantTypes.PRE_AUTHORIZED_CODE) {
      return response.status(400).json({
        error: TokenErrorResponse.invalid_request,
        error_description: PRE_AUTHORIZED_CODE_REQUIRED_ERROR,
      })
    }

    const openId4VcIssuerConfig = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)
    const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
    const issuerMetadata = openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
    const accessTokenSigningKey = Key.fromFingerprint(issuer.accessTokenPublicKeyFingerprint)

    try {
      const accessTokenResponse = await createAccessTokenResponse(request.body, {
        credentialOfferSessions: openId4VcIssuerConfig.getCredentialOfferSessionStateManager(agentContext),
        tokenExpiresIn: tokenExpiresInSeconds,
        accessTokenIssuer: issuerMetadata.issuerUrl,
        cNonce: await agentContext.wallet.generateNonce(),
        cNonceExpiresIn: cNonceExpiresInSeconds,
        cNonces: openId4VcIssuerConfig.getCNonceStateManager(agentContext),
        accessTokenSignerCallback: getJwtSignerCallback(agentContext, accessTokenSigningKey),
      })
      response.status(200).json(accessTokenResponse)
    } catch (error) {
      sendErrorResponse(response, agentContext.config.logger, 400, TokenErrorResponse.invalid_request, error)
    }

    // NOTE: if we don't call next, the agentContext session handler will NOT be called
    next()
  }
}

export function verifyTokenRequest(options: { preAuthorizedCodeExpirationInSeconds: number }) {
  return async (request: OpenId4VcIssuanceRequest, response: Response, next: NextFunction) => {
    const { agentContext } = getRequestContext(request)

    try {
      const openId4VcIssuerConfig = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)
      await assertValidAccessTokenRequest(request.body, {
        // we use seconds instead of milliseconds for consistency
        expirationDuration: options.preAuthorizedCodeExpirationInSeconds * 1000,
        credentialOfferSessions: openId4VcIssuerConfig.getCredentialOfferSessionStateManager(agentContext),
      })
    } catch (error) {
      if (error instanceof TokenError) {
        sendErrorResponse(
          response,
          agentContext.config.logger,
          error.statusCode,
          error.responseError + error.getDescription(),
          error
        )
      } else {
        sendErrorResponse(response, agentContext.config.logger, 400, TokenErrorResponse.invalid_request, error)
      }
    }

    // NOTE: if we don't call next, the agentContext session handler will NOT be called
    next()
  }
}
