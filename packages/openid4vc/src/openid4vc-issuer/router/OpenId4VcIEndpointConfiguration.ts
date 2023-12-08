import type { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import type {
  AccessTokenEndpointConfig,
  CredentialEndpointConfig,
  MetadataEndpointConfig,
} from '../OpenId4VcIssuerServiceOptions'
import type { AgentContext, Logger } from '@aries-framework/core'
import type { CredentialRequestV1_0_11 } from '@sphereon/oid4vci-common'
import type { Request, Response, Router } from 'express'

import { AriesFrameworkError, DidsApi, Jwt } from '@aries-framework/core'

import { getRequestContext, sendErrorResponse } from './../../shared/router'
import { handleTokenRequest, verifyTokenRequest } from './accessTokenEndpoint'

export interface IssuanceRequestContext {
  agentContext: AgentContext
  openId4vcIssuerService: OpenId4VcIssuerService
  logger: Logger
}

export interface IssuanceRequest extends Request {
  requestContext?: IssuanceRequestContext
}

export type InternalMetadataEndpointConfig = MetadataEndpointConfig

export interface InternalAccessTokenEndpointConfig extends AccessTokenEndpointConfig {
  cNonceExpiresIn: number
  tokenExpiresIn: number
}

export function configureAccessTokenEndpoint(
  router: Router,
  pathname: string,
  config: InternalAccessTokenEndpointConfig
) {
  const { preAuthorizedCodeExpirationDuration } = config
  router.post(pathname, verifyTokenRequest({ preAuthorizedCodeExpirationDuration }), handleTokenRequest(config))
}

export type InternalCredentialEndpointConfig = CredentialEndpointConfig

export function configureCredentialEndpoint(
  router: Router,
  pathname: string,
  config: InternalCredentialEndpointConfig
) {
  const { credentialRequestToCredentialMapper, verificationMethod } = config

  router.post(pathname, async (request: IssuanceRequest, response: Response) => {
    const requestContext = getRequestContext(request)
    const { agentContext, openId4vcIssuerService, logger } = requestContext

    try {
      const credentialRequest = request.body as CredentialRequestV1_0_11

      if (!credentialRequest.proof?.jwt) throw new AriesFrameworkError('Received a credential request without a proof')
      const jwt = Jwt.fromSerializedJwt(credentialRequest.proof?.jwt)

      const kid = jwt.header.kid
      if (!kid) throw new AriesFrameworkError('Received a credential request without a kid')

      const didsApi = agentContext.dependencyManager.resolve(DidsApi)
      const didDocument = await didsApi.resolveDidDocument(kid)
      const holderDid = didDocument.id

      const requestNonce = jwt.payload.additionalClaims.nonce
      if (!requestNonce || typeof requestNonce !== 'string') {
        throw new AriesFrameworkError(`Received a credential request without a valid nonce. ${requestNonce}`)
      }

      const cNonceState = await openId4vcIssuerService.openId4VcIssuerModuleConfig
        .getCNonceStateManager(agentContext)
        .get(requestNonce)

      const credentialOfferSessionId = cNonceState?.preAuthorizedCode ?? cNonceState?.issuerState

      if (!cNonceState || !credentialOfferSessionId) {
        throw new AriesFrameworkError(
          `Request nonce '${requestNonce}' is not associated with a preAuthorizedCode or issuerState.`
        )
      }

      const credentialOfferSession = await openId4vcIssuerService.openId4VcIssuerModuleConfig
        .getCredentialOfferSessionStateManager(agentContext)
        .get(credentialOfferSessionId)

      if (!credentialOfferSession)
        throw new AriesFrameworkError(
          `Credential offer session for request nonce '${requestNonce}' with id '${credentialOfferSessionId}' not found.`
        )

      const credential = await credentialRequestToCredentialMapper({
        agentContext,
        credentialRequest,
        holderDid,
        holderDidUrl: kid,
        cNonceState,
        credentialOfferSession,
      })

      const issueCredentialResponse = await openId4vcIssuerService.createIssueCredentialResponse(agentContext, {
        credentialRequest,
        verificationMethod,
        credential,
      })

      return response.send(issueCredentialResponse)
    } catch (e) {
      sendErrorResponse(response, logger, 500, 'invalid_request', e)
    }
  })
}
