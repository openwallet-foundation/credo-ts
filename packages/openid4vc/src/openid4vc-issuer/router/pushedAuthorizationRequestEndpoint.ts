import { AgentContext, joinUriParts, utils } from '@credo-ts/core'
import type { HttpMethod, ParsePushedAuthorizationRequestResult, RequestLike } from '@openid4vc/oauth2'
import {
  Oauth2ErrorCodes,
  Oauth2ServerErrorResponseError,
  pushedAuthorizationRequestUriPrefix,
} from '@openid4vc/oauth2'
import { addSecondsToDate } from '@openid4vc/utils'
import type { NextFunction, Response, Router } from 'express'
import type { OpenId4VciCredentialConfigurationsSupportedWithFormats } from '../../shared'
import {
  getAllowedAndRequestedScopeValues,
  getCredentialConfigurationsSupportedForScopes,
  getOfferedCredentials,
  getScopesFromCredentialConfigurationsSupported,
} from '../../shared'
import {
  getRequestContext,
  sendJsonResponse,
  sendOauth2ErrorResponse,
  sendUnknownServerErrorResponse,
} from '../../shared/router'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { OpenId4VcIssuanceSessionRecord, OpenId4VcIssuerRecord } from '../repository'
import type { OpenId4VcIssuanceRequest } from './requestContext'

export async function handlePushedAuthorizationRequest(
  agentContext: AgentContext,
  options: {
    issuer: OpenId4VcIssuerRecord
    issuanceSession: OpenId4VcIssuanceSessionRecord
    parsedAuthorizationRequest: ParsePushedAuthorizationRequestResult
    request: RequestLike
  }
) {
  const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
  const config = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)

  const { issuanceSession, parsedAuthorizationRequest, issuer, request } = options
  const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)

  if (!parsedAuthorizationRequest.authorizationRequest.scope) {
    throw new Oauth2ServerErrorResponseError({
      error: Oauth2ErrorCodes.InvalidScope,
      error_description: `Missing required 'scope' parameter`,
    })
  }

  if (!parsedAuthorizationRequest.authorizationRequest.redirect_uri) {
    throw new Oauth2ServerErrorResponseError({
      error: Oauth2ErrorCodes.InvalidScope,
      error_description: `Missing required 'redirect_uri' parameter.`,
    })
  }

  const allowedStates = [OpenId4VcIssuanceSessionState.OfferCreated, OpenId4VcIssuanceSessionState.OfferUriRetrieved]
  if (!allowedStates.includes(issuanceSession.state)) {
    throw new Oauth2ServerErrorResponseError(
      {
        error: Oauth2ErrorCodes.InvalidRequest,
        error_description: `Invalid 'issuer_state' parameter`,
      },
      {
        internalMessage: `Issuance session '${issuanceSession.id}' has state '${
          issuanceSession.state
        }' but expected one of ${allowedStates.join(', ')}`,
      }
    )
  }

  if (!issuanceSession.chainedIdentity?.externalAuthorizationServerUrl) {
    throw new Oauth2ServerErrorResponseError(
      {
        error: Oauth2ErrorCodes.InvalidRequest,
        error_description: `Unexpected redirect call for session.`,
      },
      {
        internalMessage: `Issuance session '${issuanceSession.id}' is not configured to use chained identity for authorization.`,
      }
    )
  }

  const authorizationServer = openId4VcIssuerService.getOauth2AuthorizationServer(agentContext, {
    issuanceSessionId: issuanceSession.id,
  })

  const { clientAttestation, dpop } = await authorizationServer.verifyPushedAuthorizationRequest({
    authorizationRequest: parsedAuthorizationRequest.authorizationRequest,
    // First authorization server is the internal authorization server
    authorizationServerMetadata: issuerMetadata.authorizationServers[0],
    request,
    clientAttestation: {
      ...parsedAuthorizationRequest.clientAttestation,
      // First session config, fall back to global config
      required: issuanceSession.walletAttestation?.required ?? config.walletAttestationsRequired,
    },
    dpop: {
      ...parsedAuthorizationRequest.dpop,
      // First session config, fall back to global config
      required: issuanceSession.dpop?.required ?? config.dpopRequired,
    },
  })

  if (dpop) {
    // Bind dpop jwk thumbprint to session
    issuanceSession.dpop = {
      // If dpop is provided at the start, it's required from now on.
      required: true,
      dpopJkt: dpop.jwkThumbprint,
    }
  }

  if (clientAttestation) {
    issuanceSession.walletAttestation = {
      // If client attestation is provided at the start, it's required from now on.
      required: true,
    }
  }

  const offeredCredentialConfigurations = getOfferedCredentials(
    issuanceSession.credentialOfferPayload.credential_configuration_ids,
    issuerMetadata.credentialIssuer.credential_configurations_supported
  )
  const allowedScopes = getScopesFromCredentialConfigurationsSupported(offeredCredentialConfigurations)
  const requestedScopes = getAllowedAndRequestedScopeValues({
    allowedScopes,
    requestedScope: parsedAuthorizationRequest.authorizationRequest.scope,
  })
  const requestedCredentialConfigurations = getCredentialConfigurationsSupportedForScopes(
    offeredCredentialConfigurations,
    requestedScopes
  ) as OpenId4VciCredentialConfigurationsSupportedWithFormats
  if (requestedScopes.length === 0 || Object.keys(requestedCredentialConfigurations).length === 0) {
    throw new Oauth2ServerErrorResponseError({
      error: Oauth2ErrorCodes.InvalidScope,
      error_description: `No requested 'scope' values match with offered credential configurations.`,
    })
  }

  issuanceSession.authorization = {
    ...issuanceSession.authorization,
    scopes: requestedScopes,
  }

  // If client attestation is used we have verified this client_id matches with the sub
  // of the wallet attestation
  issuanceSession.clientId =
    clientAttestation?.clientAttestation.payload.sub ?? parsedAuthorizationRequest.authorizationRequest.client_id

  const oauth2Client = openId4VcIssuerService.getOauth2Client(agentContext, issuer)
  const authorizationServerUrl = issuanceSession.chainedIdentity.externalAuthorizationServerUrl

  const authorizationServerConfig = issuer.chainedAuthorizationServerConfigs?.find(
    (config) => config.issuer === authorizationServerUrl
  )
  if (!authorizationServerConfig) {
    throw new Oauth2ServerErrorResponseError(
      {
        error: Oauth2ErrorCodes.ServerError,
      },
      {
        internalMessage: `Issuer '${issuer.issuerId}' does not have a chained authorization server config for issuer '${authorizationServerUrl}'`,
      }
    )
  }

  const authorizationServerMetadata = await oauth2Client.fetchAuthorizationServerMetadata(
    authorizationServerConfig.issuer
  )
  if (!authorizationServerMetadata) {
    throw new Oauth2ServerErrorResponseError(
      {
        error: Oauth2ErrorCodes.ServerError,
        error_description: `Unable to retrieve authorization server metadata from external identity provider.`,
      },
      {
        internalMessage: `Unable to retrieve authorization server metadata from '${authorizationServerConfig.issuer}'`,
      }
    )
  }

  const redirectUri = joinUriParts(config.baseUrl, [issuer.issuerId, 'redirect'])
  const chainedIdentityState = utils.uuid()

  const scopes = requestedScopes.flatMap((scope) => {
    if (scope in authorizationServerConfig.scopesMapping) {
      return authorizationServerConfig.scopesMapping[scope]
    }

    throw new Oauth2ServerErrorResponseError(
      {
        error: Oauth2ErrorCodes.ServerError,
      },
      {
        internalMessage: `Issuer '${issuer.issuerId}' does not have a scope mapping for scope '${scope}' for external authorization server '${authorizationServerConfig.issuer}'`,
      }
    )
  })

  // TODO: add support for DPoP
  const { authorizationRequestUrl, pkce } = await oauth2Client.initiateAuthorization({
    authorizationServerMetadata,
    clientId: authorizationServerConfig.clientAuthentication.clientId,
    redirectUri,
    state: chainedIdentityState,
    scope: scopes.join(' '),
  })

  issuanceSession.chainedIdentity = {
    ...issuanceSession.chainedIdentity,
    requestUriReferenceValue: utils.uuid(),
    externalAuthorizationRequestUrl: authorizationRequestUrl,
    requestUriExpiresAt: addSecondsToDate(new Date(), config.requestUriExpiresInSeconds),
    pkceCodeVerifier: pkce?.codeVerifier,
    externalState: chainedIdentityState,
    state: parsedAuthorizationRequest.authorizationRequest.state,
    redirectUri: parsedAuthorizationRequest.authorizationRequest.redirect_uri,
    externalAuthorizationServerMetadata: authorizationServerMetadata,
  }

  const { pushedAuthorizationResponse } = authorizationServer.createPushedAuthorizationResponse({
    expiresInSeconds: config.requestUriExpiresInSeconds,
    requestUri: pushedAuthorizationRequestUriPrefix + issuanceSession.chainedIdentity.requestUriReferenceValue,
  })

  await openId4VcIssuerService.updateState(
    agentContext,
    issuanceSession,
    OpenId4VcIssuanceSessionState.AuthorizationInitiated
  )

  return { pushedAuthorizationResponse }
}

export function configurePushedAuthorizationRequestEndpoint(router: Router, config: OpenId4VcIssuerModuleConfig) {
  router.post(
    config.pushedAuthorizationRequestEndpoint,
    async (request: OpenId4VcIssuanceRequest, response: Response, next: NextFunction) => {
      const requestContext = getRequestContext(request)
      const { agentContext, issuer } = requestContext

      try {
        const config = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)
        const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
        const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
        const authorizationServer = openId4VcIssuerService.getOauth2AuthorizationServer(agentContext)
        const fullRequestUrl = joinUriParts(issuerMetadata.credentialIssuer.credential_issuer, [
          config.pushedAuthorizationRequestEndpoint,
        ])

        const requestLike = {
          headers: new Headers(request.headers as Record<string, string>),
          method: request.method as HttpMethod,
          url: fullRequestUrl,
        } as const

        const parseResult = await authorizationServer.parsePushedAuthorizationRequest({
          authorizationRequest: request.body,
          request: requestLike,
        })

        if (parseResult.authorizationRequestJwt) {
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.InvalidRequest,
            error_description: `Using JWT-secured authorization request is not supported.`,
          })
        }

        // TODO: we could allow dynamic issuance sessions here. Maybe based on a callback?
        // Not sure how to decide which credentials are allowed to be requested dynamically
        if (!parseResult.authorizationRequest.issuer_state) {
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.InvalidRequest,
            error_description: `Missing required 'issuer_state' parameter. Only requests initiated by a credential offer are supported for pushed authorization requests.`,
          })
        }

        if (!parseResult.authorizationRequest.scope) {
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.InvalidScope,
            error_description: `Missing required 'scope' parameter`,
          })
        }

        const issuanceSession = await openId4VcIssuerService.findSingleIssuanceSessionByQuery(agentContext, {
          issuerId: issuer.issuerId,
          issuerState: parseResult.authorizationRequest.issuer_state,
        })

        if (!issuanceSession) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidRequest,
              error_description: `Invalid 'issuer_state' parameter`,
            },
            {
              internalMessage: `Issuance session not found for 'issuer_state' parameter '${parseResult.authorizationRequest.issuer_state}'`,
            }
          )
        }

        const { pushedAuthorizationResponse } = await handlePushedAuthorizationRequest(agentContext, {
          issuanceSession,
          issuer,
          parsedAuthorizationRequest: parseResult,
          request: requestLike,
        })

        return sendJsonResponse(response, next, pushedAuthorizationResponse)
      } catch (error) {
        if (error instanceof Oauth2ServerErrorResponseError) {
          return sendOauth2ErrorResponse(response, next, agentContext.config.logger, error)
        }
        return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error)
      }
    }
  )
}
