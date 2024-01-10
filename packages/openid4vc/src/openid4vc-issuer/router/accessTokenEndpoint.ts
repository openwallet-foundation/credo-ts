import type { IssuanceRequest } from './requestContext'
import type { AccessTokenEndpointConfig } from '../OpenId4VcIssuerServiceOptions'
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

const getJwtSignerCallback = (agentContext: AgentContext, signerPublicKey: Key): JWTSignerCallback => {
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

export const handleTokenRequest = (config: AccessTokenEndpointConfig) => {
  const { tokenExpiresInSeconds, cNonceExpiresInSeconds, interval } = config

  return async (request: IssuanceRequest, response: Response) => {
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
        interval,
      })
      return response.status(200).json(accessTokenResponse)
    } catch (error) {
      sendErrorResponse(response, agentContext.config.logger, 400, TokenErrorResponse.invalid_request, error)
    }
  }
}

export const verifyTokenRequest = (options: { preAuthorizedCodeExpirationInSeconds: number }) => {
  const { preAuthorizedCodeExpirationInSeconds } = options
  return async (request: IssuanceRequest, response: Response, next: NextFunction) => {
    const { agentContext } = getRequestContext(request)
    const openId4VcIssuerConfig = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)

    try {
      await assertValidAccessTokenRequest(request.body, {
        // we use seconds instead of milliseconds for consistency
        expirationDuration: preAuthorizedCodeExpirationInSeconds * 1000,
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

    return next()
  }
}

export function configureAccessTokenEndpoint(router: Router, config: AccessTokenEndpointConfig) {
  const { preAuthorizedCodeExpirationInSeconds } = config
  router.post(
    config.endpointPath,
    verifyTokenRequest({ preAuthorizedCodeExpirationInSeconds }),
    handleTokenRequest(config)
  )
}
