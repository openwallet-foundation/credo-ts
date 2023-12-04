import type {
  IssuerMetadata,
  CreateIssueCredentialResponseOptions,
  MetadataEndpointConfig,
  CredentialEndpointConfig,
  AccessTokenEndpointConfig,
  CredentialSupported,
} from '../OpenId4VcIssuerServiceOptions'
import type {
  CNonceState,
  CredentialIssuerMetadata,
  CredentialOfferSession,
  CredentialRequestV1_0_11,
  CredentialResponse,
  IStateManager,
} from '@sphereon/oid4vci-common'
import type { Router, Request, Response } from 'express'

import { Jwt, type AgentContext, type Logger, DidsApi, AriesFrameworkError } from '@aries-framework/core'

import { handleTokenRequest, verifyTokenRequest } from './accessTokenEndpoint'
import { getEndpointMetadata, sendErrorResponse } from './utils'

export interface InternalMetadataEndpointConfig extends MetadataEndpointConfig {
  issuerMetadata: IssuerMetadata
}

export function configureIssuerMetadataEndpoint(
  router: Router,
  logger: Logger,
  config: InternalMetadataEndpointConfig
) {
  const { issuerMetadata } = config
  const wellKnownPath = `/.well-known/openid-credential-issuer`

  const { path, url } = getEndpointMetadata(wellKnownPath, issuerMetadata.credentialIssuer)
  logger.info(`[OID4VCI] metadata hosted at '${url.toString()}'.`)

  const transformedMetadata: CredentialIssuerMetadata = {
    credentials_supported: issuerMetadata.credentialsSupported as CredentialSupported[],
    credential_endpoint: issuerMetadata.credentialEndpoint,
    authorization_server: issuerMetadata.authorizationServer,
    credential_issuer: issuerMetadata.credentialIssuer,
    display: issuerMetadata.issuerDisplay ? [issuerMetadata.issuerDisplay] : undefined,
    token_endpoint: issuerMetadata.tokenEndpoint,
  }

  router.get(path, (_request: Request, response: Response) => {
    response.status(200).json(transformedMetadata)
  })
}

export interface InternalAccessTokenEndpointConfig extends AccessTokenEndpointConfig {
  issuerMetadata: IssuerMetadata
  cNonceExpiresIn: number
  tokenExpiresIn: number
  cNonceStateManager: IStateManager<CNonceState>
  credentialOfferSessionManager: IStateManager<CredentialOfferSession>
}

export function configureAccessTokenEndpoint(
  agentContext: AgentContext,
  router: Router,
  logger: Logger,
  config: InternalAccessTokenEndpointConfig
) {
  const { issuerMetadata, credentialOfferSessionManager, preAuthorizedCodeExpirationDuration } = config

  const { path, url } = getEndpointMetadata(issuerMetadata.tokenEndpoint, issuerMetadata.credentialIssuer)
  logger.info(`[OID4VCI] Token endpoint running at '${url.toString()}'.`)

  router.post(
    path,

    verifyTokenRequest({
      logger,
      credentialOfferSessionManager,
      preAuthorizedCodeExpirationDuration,
    }),

    handleTokenRequest(agentContext, logger, config)
  )
}

export interface InternalCredentialEndpointConfig extends CredentialEndpointConfig {
  issuerMetadata: IssuerMetadata
  cNonceStateManager: IStateManager<CNonceState>
  credentialOfferSessionManager: IStateManager<CredentialOfferSession>
  createIssueCredentialResponse: (
    agentContext: AgentContext,
    options: CreateIssueCredentialResponseOptions
  ) => Promise<CredentialResponse>
}

export function configureCredentialEndpoint(
  agentContext: AgentContext,
  router: Router,
  logger: Logger,
  config: InternalCredentialEndpointConfig
): void {
  const {
    issuerMetadata,
    credentialRequestToCredentialMapper,
    verificationMethod,
    cNonceStateManager,
    credentialOfferSessionManager,
  } = config

  const { path, url } = getEndpointMetadata(issuerMetadata.credentialEndpoint, issuerMetadata.credentialIssuer)
  logger.info(`[OID4VCI] Token endpoint running at '${url.toString()}'.`)

  router.post(path, async (request: Request, response: Response) => {
    try {
      const credentialRequest = request.body as CredentialRequestV1_0_11

      if (!credentialRequest.proof?.jwt) throw new AriesFrameworkError('Received a credential request without a proof')
      const jwt = Jwt.fromSerializedJwt(credentialRequest.proof?.jwt)

      const kid = jwt.header.kid
      if (!kid) {
        throw new AriesFrameworkError('Received a credential request without a kid')
      }

      const didsApi = agentContext.dependencyManager.resolve(DidsApi)
      const didDocument = await didsApi.resolveDidDocument(kid)
      const holderDid = didDocument.id

      const requestNonce = jwt.payload.additionalClaims.nonce
      if (!requestNonce || typeof requestNonce !== 'string') {
        throw new AriesFrameworkError(`Received a credential request without a valid nonce. ${requestNonce}`)
      }

      const cNonceState = await cNonceStateManager.get(requestNonce)

      const credentialOfferSessionId = cNonceState?.preAuthorizedCode ?? cNonceState?.issuerState

      if (!cNonceState || !credentialOfferSessionId) {
        throw new AriesFrameworkError(
          `Request nonce '${requestNonce}' is not associated with a preAuthorizedCode or issuerState.`
        )
      }

      const credentialOfferSession = await credentialOfferSessionManager.get(credentialOfferSessionId)
      if (!credentialOfferSession)
        throw new AriesFrameworkError(
          `Credential offer session for request nonce '${requestNonce}' with id '${credentialOfferSessionId}' not found.`
        )

      const credential = await credentialRequestToCredentialMapper(credentialRequest, {
        holderDid,
        holderDidUrl: kid,
        cNonceState,
        credentialOfferSession,
      })

      const issueCredentialResponse = await config.createIssueCredentialResponse(agentContext, {
        credentialRequest,
        issuerMetadata,
        verificationMethod,
        credential,
      })
      return response.send(issueCredentialResponse)
    } catch (e) {
      sendErrorResponse(response, logger, 500, 'invalid_request', e)
    }
  })
}
