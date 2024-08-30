import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { AgentContext } from '@credo-ts/core'
import type { JWK, SigningAlgo } from '@sphereon/oid4vc-common'
import type {
  AccessTokenResponse,
  CredentialOfferSession,
  IStateManager,
  JWTSignerCallback,
  Jwt,
} from '@sphereon/oid4vci-common'
import type { ITokenEndpointOpts } from '@sphereon/oid4vci-issuer'
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
import { calculateJwkThumbprint, verifyDPoP } from '@sphereon/oid4vc-common'
import {
  Alg,
  EXPIRED_PRE_AUTHORIZED_CODE,
  GrantTypes,
  INVALID_PRE_AUTHORIZED_CODE,
  IssueStatus,
  PIN_NOT_MATCH_ERROR,
  PIN_VALIDATION_ERROR,
  PRE_AUTH_CODE_LITERAL,
  TokenError,
  TokenErrorResponse,
  UNSUPPORTED_GRANT_TYPE_ERROR,
  USER_PIN_NOT_REQUIRED_ERROR,
  USER_PIN_REQUIRED_ERROR,
} from '@sphereon/oid4vci-common'
import { isPreAuthorizedCodeExpired } from '@sphereon/oid4vci-issuer'

import { getRequestContext, sendErrorResponse } from '../../shared/router'
import { getVerifyJwtCallback } from '../../shared/utils'
import { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { OpenId4VcCNonceStateManager } from '../repository/OpenId4VcCNonceStateManager'
import { OpenId4VcCredentialOfferSessionStateManager } from '../repository/OpenId4VcCredentialOfferSessionStateManager'

// TODO
export const isValidGrant = (assertedState: CredentialOfferSession, grantType: string): boolean => {
  if (assertedState.credentialOffer?.credential_offer?.grants) {
    const validPreAuthorizedGrant =
      Object.keys(assertedState.credentialOffer.credential_offer.grants).includes(GrantTypes.PRE_AUTHORIZED_CODE) &&
      grantType === GrantTypes.PRE_AUTHORIZED_CODE

    const validAuthorizationCodeGrant =
      Object.keys(assertedState.credentialOffer.credential_offer.grants).includes(GrantTypes.AUTHORIZATION_CODE) &&
      grantType === GrantTypes.AUTHORIZATION_CODE
    return validAuthorizationCodeGrant || validPreAuthorizedGrant
  }
  return false
}

// TODO: Update in Sphereon OID4VCI
export const assertValidAccessTokenRequest = async (
  request: AccessTokenRequest,
  opts: {
    credentialOfferSessions: IStateManager<CredentialOfferSession>
    expirationDuration: number
  }
) => {
  const { credentialOfferSessions, expirationDuration } = opts
  // Only pre-auth supported for now
  if (request.grant_type !== GrantTypes.PRE_AUTHORIZED_CODE && request.grant_type !== GrantTypes.AUTHORIZATION_CODE) {
    throw new TokenError(400, TokenErrorResponse.invalid_grant, UNSUPPORTED_GRANT_TYPE_ERROR)
  }

  // Pre-auth flow
  const preAuthorizedCode =
    request.grant_type === GrantTypes.PRE_AUTHORIZED_CODE ? request[PRE_AUTH_CODE_LITERAL] : undefined
  const issuerStatus = request.grant_type === GrantTypes.AUTHORIZATION_CODE ? request.issuer_state : undefined

  if (!preAuthorizedCode && !issuerStatus) {
    throw new TokenError(
      400,
      TokenErrorResponse.invalid_request,
      "Either 'pre-authorized_code' or 'authorization_code' is required"
    )
  }

  const code = (preAuthorizedCode ?? issuerStatus) as string

  const credentialOfferSession = await credentialOfferSessions.getAsserted(code)

  if (![IssueStatus.OFFER_CREATED, IssueStatus.OFFER_URI_RETRIEVED].includes(credentialOfferSession.status)) {
    throw new TokenError(400, TokenErrorResponse.invalid_request, 'Access token has already been retrieved')
  }

  credentialOfferSession.status = IssueStatus.ACCESS_TOKEN_REQUESTED
  credentialOfferSession.lastUpdatedAt = +new Date()
  await credentialOfferSessions.set(code, credentialOfferSession)

  if (!isValidGrant(credentialOfferSession, request.grant_type)) {
    throw new TokenError(400, TokenErrorResponse.invalid_grant, UNSUPPORTED_GRANT_TYPE_ERROR)
  }

  if (preAuthorizedCode) {
    /*
  invalid_request:
  the Authorization Server expects a PIN in the pre-authorized flow but the client does not provide a PIN
   */
    if (
      credentialOfferSession.credentialOffer.credential_offer.grants?.[GrantTypes.PRE_AUTHORIZED_CODE]
        ?.user_pin_required &&
      !request.user_pin
    ) {
      throw new TokenError(400, TokenErrorResponse.invalid_request, USER_PIN_REQUIRED_ERROR)
    }

    /*
  invalid_request:
  the Authorization Server does not expect a PIN in the pre-authorized flow but the client provides a PIN
   */
    if (
      !credentialOfferSession.credentialOffer.credential_offer.grants?.[GrantTypes.PRE_AUTHORIZED_CODE]
        ?.user_pin_required &&
      request.user_pin
    ) {
      throw new TokenError(400, TokenErrorResponse.invalid_request, USER_PIN_NOT_REQUIRED_ERROR)
    }

    /*
  invalid_grant:
  the Authorization Server expects a PIN in the pre-authorized flow but the client provides the wrong PIN
  the End-User provides the wrong Pre-Authorized Code or the Pre-Authorized Code has expired
   */
    if (request.user_pin && !/[0-9{,8}]/.test(request.user_pin)) {
      throw new TokenError(400, TokenErrorResponse.invalid_grant, PIN_VALIDATION_ERROR)
    } else if (request.user_pin !== credentialOfferSession.txCode) {
      throw new TokenError(400, TokenErrorResponse.invalid_grant, PIN_NOT_MATCH_ERROR)
    } else if (isPreAuthorizedCodeExpired(credentialOfferSession, expirationDuration)) {
      throw new TokenError(400, TokenErrorResponse.invalid_grant, EXPIRED_PRE_AUTHORIZED_CODE)
    } else if (
      request[PRE_AUTH_CODE_LITERAL] !==
      credentialOfferSession.credentialOffer.credential_offer.grants?.[GrantTypes.PRE_AUTHORIZED_CODE]?.[
        PRE_AUTH_CODE_LITERAL
      ]
    ) {
      throw new TokenError(400, TokenErrorResponse.invalid_grant, INVALID_PRE_AUTHORIZED_CODE)
    }
    return { preAuthSession: credentialOfferSession }
  }

  // Authorization code flow

  const authorizationCodeGrant = credentialOfferSession.credentialOffer.credential_offer.grants?.authorization_code

  if (authorizationCodeGrant?.issuer_state !== credentialOfferSession.issuerState) {
    throw new TokenError(
      400,
      TokenErrorResponse.invalid_request,
      'Issuer state does not match credential offer issuance state'
    )
  }

  // TODO: rename to isCodeExpired
  if (isPreAuthorizedCodeExpired(credentialOfferSession, expirationDuration)) {
    throw new TokenError(400, TokenErrorResponse.invalid_grant, 'Issuer state is expired')
  }

  if (!authorizationCodeGrant?.issuer_state || request.issuer_state !== authorizationCodeGrant.issuer_state) {
    throw new TokenError(400, TokenErrorResponse.invalid_grant, 'Issuer state is invalid')
  }
  return { preAuthSession: credentialOfferSession }
}

// TODO: Update in Sphereon OID4VCI

export interface AccessTokenRequest {
  client_id?: string
  code?: string
  code_verifier?: string
  grant_type: GrantTypes
  'pre-authorized_code'?: string
  issuer_state?: string
  redirect_uri?: string
  scope?: string
  user_pin?: string
}

/**
 * TODO: create pr to support issuerState in `createAccessTokenResponse`
 * Copy from '@sphereon/oid4vci-issuer'
 * @param opts
 * @returns
 */
export const generateAccessToken = async (
  opts: Required<Pick<ITokenEndpointOpts, 'accessTokenSignerCallback' | 'tokenExpiresIn' | 'accessTokenIssuer'>> & {
    preAuthorizedCode?: string
    issuerState?: string
    alg?: Alg
    dPoPJwk?: JWK
  }
): Promise<string> => {
  const { dPoPJwk, accessTokenIssuer, alg, accessTokenSignerCallback, tokenExpiresIn, preAuthorizedCode, issuerState } =
    opts
  // JWT uses seconds for iat and exp
  const iat = new Date().getTime() / 1000
  const exp = iat + tokenExpiresIn
  const cnf = dPoPJwk ? { cnf: { jkt: await calculateJwkThumbprint(dPoPJwk, 'sha256') } } : undefined
  const jwt: Jwt = {
    header: { typ: 'JWT', alg: alg ?? Alg.ES256 },
    payload: {
      iat,
      exp,
      iss: accessTokenIssuer,
      ...cnf,
      ...(preAuthorizedCode && { preAuthorizedCode }),
      ...(issuerState && { issuerState }),
      // Protected resources simultaneously supporting both the DPoP and Bearer schemes need to update how the
      // evaluation process is performed for bearer tokens to prevent downgraded usage of a DPoP-bound access token.
      // Specifically, such a protected resource MUST reject a DPoP-bound access token received as a bearer token per [RFC6750].
      token_type: dPoPJwk ? 'DPoP' : 'Bearer',
    },
  }
  return await accessTokenSignerCallback(jwt)
}

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
  router.post(
    config.endpointPath,
    verifyTokenRequest({ codeExpirationInSeconds: config.preAuthorizedCodeExpirationInSeconds }),
    handleTokenRequest(config)
  )
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

    const body = request.body as AccessTokenRequest

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
          agentContext.config.logger,
          400,
          TokenErrorResponse.invalid_dpop_proof,
          error instanceof Error ? error.message : 'Unknown error'
        )
      }
    }

    try {
      const code = body.issuer_state
        ? { type: 'issuerState' as const, value: body.issuer_state }
        : { type: 'preAuthorized' as const, value: body[PRE_AUTH_CODE_LITERAL] as string }

      const cNonceStateManager = new OpenId4VcCNonceStateManager(agentContext, issuer.issuerId)
      const cNonce = await agentContext.wallet.generateNonce()
      await cNonceStateManager.set(
        cNonce,
        {
          cNonce,
          createdAt: +new Date(),
          ...(code.type === 'issuerState' && { issuerState: code.value }),
          ...(code.type === 'preAuthorized' && { preAuthorizedCode: code.value }),
        },
        code.type
      )

      const access_token = await generateAccessToken({
        tokenExpiresIn: 3600,
        accessTokenIssuer: issuerMetadata.issuerUrl,
        accessTokenSignerCallback: getJwtSignerCallback(agentContext, accessTokenSigningKey, config),
        ...(code.type === 'issuerState' && { issuerState: code.value }),
        ...(code.type === 'preAuthorized' && { preAuthorizedCode: code.value }),
        dPoPJwk: dpopJwk,
      })

      const accessTokenResponse: AccessTokenResponse = {
        access_token,
        expires_in: tokenExpiresInSeconds,
        c_nonce: cNonce,
        c_nonce_expires_in: cNonceExpiresInSeconds,
        authorization_pending: false,
        interval: undefined,
        token_type: dpopJwk ? 'DPoP' : 'Bearer',
      }

      const credentialOfferStateManager = new OpenId4VcCredentialOfferSessionStateManager(agentContext, issuer.issuerId)
      const credentialOfferSession = await credentialOfferStateManager.getAsserted(code.value, code.type)
      credentialOfferSession.status = IssueStatus.ACCESS_TOKEN_CREATED
      credentialOfferSession.lastUpdatedAt = +new Date()
      await credentialOfferStateManager.set(code.value, credentialOfferSession, code.type)

      response.status(200).json(accessTokenResponse)
    } catch (error) {
      sendErrorResponse(response, agentContext.config.logger, 400, TokenErrorResponse.invalid_request, error)
    }

    // NOTE: if we don't call next, the agentContext session handler will NOT be called
    next()
  }
}

export function verifyTokenRequest(options: { codeExpirationInSeconds: number }) {
  return async (request: OpenId4VcIssuanceRequest, response: Response, next: NextFunction) => {
    const { agentContext, issuer } = getRequestContext(request)

    try {
      await assertValidAccessTokenRequest(request.body, {
        expirationDuration: options.codeExpirationInSeconds,
        credentialOfferSessions: new OpenId4VcCredentialOfferSessionStateManager(agentContext, issuer.issuerId),
      })
    } catch (error) {
      if (error instanceof TokenError) {
        sendErrorResponse(
          response,
          agentContext.config.logger,
          error.statusCode,
          error.responseError,
          error.getDescription()
        )
      } else {
        sendErrorResponse(response, agentContext.config.logger, 400, TokenErrorResponse.invalid_request, error)
      }
    }

    // NOTE: if we don't call next, the agentContext session handler will NOT be called
    next()
  }
}
