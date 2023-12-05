import type { InternalAccessTokenEndpointConfig } from './OpenId4VcIEndpointConfiguration'
import type { AgentContext, Logger, VerificationMethod, JwkJson } from '@aries-framework/core'
import type { CredentialOfferSession, IStateManager, JWTSignerCallback } from '@sphereon/oid4vci-common'
import type { NextFunction, Request, Response } from 'express'

import {
  AriesFrameworkError,
  JwsService,
  getJwkFromJson,
  getKeyFromVerificationMethod,
  JwtPayload,
  getJwkClassFromKeyType,
} from '@aries-framework/core'
import {
  GrantTypes,
  PRE_AUTHORIZED_CODE_REQUIRED_ERROR,
  TokenError,
  TokenErrorResponse,
} from '@sphereon/oid4vci-common'
import { assertValidAccessTokenRequest, createAccessTokenResponse } from '@sphereon/oid4vci-issuer'

import { sendErrorResponse } from './utils'

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

export const handleTokenRequest = (
  agentContext: AgentContext,
  logger: Logger,
  config: InternalAccessTokenEndpointConfig
) => {
  const { tokenExpiresIn, cNonceExpiresIn, interval } = config

  return async (request: Request, response: Response) => {
    response.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' })

    if (request.body.grant_type !== GrantTypes.PRE_AUTHORIZED_CODE) {
      return response.status(400).json({
        error: TokenErrorResponse.invalid_request,
        error_description: PRE_AUTHORIZED_CODE_REQUIRED_ERROR,
      })
    }

    try {
      const accessTokenResponse = await createAccessTokenResponse(request.body, {
        credentialOfferSessions: config.credentialOfferSessionManager,
        tokenExpiresIn,
        accessTokenIssuer: config.issuerMetadata.credentialIssuer,
        cNonce: await agentContext.wallet.generateNonce(),
        cNonceExpiresIn,
        cNonces: config.cNonceStateManager,
        accessTokenSignerCallback: getJwtSignerCallback(agentContext, config.verificationMethod),
        interval,
      })
      return response.status(200).json(accessTokenResponse)
    } catch (error) {
      sendErrorResponse(response, logger, 400, TokenErrorResponse.invalid_request, error)
    }
  }
}

export const verifyTokenRequest = (options: {
  preAuthorizedCodeExpirationDuration: number
  credentialOfferSessionManager: IStateManager<CredentialOfferSession>
  logger: Logger
}) => {
  const { preAuthorizedCodeExpirationDuration, credentialOfferSessionManager, logger } = options
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      await assertValidAccessTokenRequest(request.body, {
        // we use seconds instead of milliseconds for consistency
        expirationDuration: preAuthorizedCodeExpirationDuration * 1000,
        credentialOfferSessions: credentialOfferSessionManager,
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
