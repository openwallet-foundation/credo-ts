import type { InternalAccessTokenEndpointConfig, IssuanceRequest } from './OpenId4VcIEndpointConfiguration'
import type { AgentContext, JwkJson, VerificationMethod } from '@aries-framework/core'
import type { JWTSignerCallback } from '@sphereon/oid4vci-common'
import type { NextFunction, Response } from 'express'

import {
  AriesFrameworkError,
  JwsService,
  JwtPayload,
  getJwkClassFromKeyType,
  getJwkFromJson,
  getKeyFromVerificationMethod,
} from '@aries-framework/core'
import {
  GrantTypes,
  PRE_AUTHORIZED_CODE_REQUIRED_ERROR,
  TokenError,
  TokenErrorResponse,
} from '@sphereon/oid4vci-common'
import { assertValidAccessTokenRequest, createAccessTokenResponse } from '@sphereon/oid4vci-issuer'

import { getRequestContext, sendErrorResponse } from '../../shared/router'

const getJwtSignerCallback = (
  agentContext: AgentContext,
  verificationMethod: VerificationMethod
): JWTSignerCallback => {
  return async (jwt, _kid) => {
    if (_kid) throw new AriesFrameworkError('Kid should not be supplied externally.')

    const jwsService = agentContext.dependencyManager.resolve(JwsService)
    const key = getKeyFromVerificationMethod(verificationMethod)

    const alg = getJwkClassFromKeyType(key.keyType)?.supportedSignatureAlgorithms[0]
    if (!alg) throw new AriesFrameworkError(`No supported signature algorithms for key type: ${key.keyType}`)

    const jwk = jwt.header.jwk ? getJwkFromJson(jwt.header.jwk as JwkJson) : undefined

    const signedJwt: string = await jwsService.createJwsCompact(agentContext, {
      protectedHeaderOptions: { ...jwt.header, jwk, kid: verificationMethod.id, alg },
      payload: new JwtPayload(jwt.payload),
      key,
    })

    return signedJwt
  }
}

export const handleTokenRequest = (config: InternalAccessTokenEndpointConfig) => {
  const { tokenExpiresIn, cNonceExpiresIn, interval } = config

  return async (request: IssuanceRequest, response: Response) => {
    response.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' })

    const requestContext = getRequestContext(request)
    const { agentContext, openId4vcIssuerService, logger } = requestContext

    if (request.body.grant_type !== GrantTypes.PRE_AUTHORIZED_CODE) {
      return response.status(400).json({
        error: TokenErrorResponse.invalid_request,
        error_description: PRE_AUTHORIZED_CODE_REQUIRED_ERROR,
      })
    }

    try {
      const accessTokenResponse = await createAccessTokenResponse(request.body, {
        credentialOfferSessions:
          openId4vcIssuerService.openId4VcIssuerModuleConfig.getCredentialOfferSessionStateManager(agentContext),
        tokenExpiresIn,
        accessTokenIssuer: openId4vcIssuerService.expandEndpointsWithBase(agentContext).issuerBaseUrl,
        cNonce: await agentContext.wallet.generateNonce(),
        cNonceExpiresIn,
        cNonces: openId4vcIssuerService.openId4VcIssuerModuleConfig.getCNonceStateManager(agentContext),
        accessTokenSignerCallback: getJwtSignerCallback(agentContext, config.verificationMethod),
        interval,
      })
      return response.status(200).json(accessTokenResponse)
    } catch (error) {
      sendErrorResponse(response, logger, 400, TokenErrorResponse.invalid_request, error)
    }
  }
}

export const verifyTokenRequest = (options: { preAuthorizedCodeExpirationDuration: number }) => {
  const { preAuthorizedCodeExpirationDuration } = options
  return async (request: IssuanceRequest, response: Response, next: NextFunction) => {
    const requestContext = getRequestContext(request)
    const { agentContext, openId4vcIssuerService, logger } = requestContext

    try {
      await assertValidAccessTokenRequest(request.body, {
        // we use seconds instead of milliseconds for consistency
        expirationDuration: preAuthorizedCodeExpirationDuration * 1000,
        credentialOfferSessions:
          openId4vcIssuerService.openId4VcIssuerModuleConfig.getCredentialOfferSessionStateManager(agentContext),
      })
    } catch (error) {
      if (error instanceof TokenError) {
        sendErrorResponse(response, logger, error.statusCode, error.responseError + error.getDescription(), error)
      } else {
        sendErrorResponse(response, logger, 400, TokenErrorResponse.invalid_request, error)
      }
    }

    return next()
  }
}
