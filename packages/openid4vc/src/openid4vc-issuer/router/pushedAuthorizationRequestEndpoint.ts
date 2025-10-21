import type {
  HttpMethod,
  ParsePushedAuthorizationRequestResult,
  VerifyPushedAuthorizationRequestOptions,
} from '@openid4vc/oauth2'
import type { NextFunction, Response, Router } from 'express'
import type { OpenId4VciCredentialConfigurationsSupportedWithFormats } from '../../shared'
import type { OpenId4VcIssuanceRequest } from './requestContext'

import { AgentContext, joinUriParts, utils } from '@credo-ts/core'
import { Oauth2ErrorCodes, Oauth2ServerErrorResponseError } from '@openid4vc/oauth2'
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
import { addSecondsToDate } from '../../shared/utils'

// TODO: move
export const pushedAuthorizationRequestUriPrefix = 'urn:ietf:params:oauth:request_uri:'

export async function handlePushedAuthorizationRequest(
  agentContext: AgentContext,
  options: {
    issuer: OpenId4VcIssuerRecord
    issuanceSession: OpenId4VcIssuanceSessionRecord
    parsedAuthorizationRequest: ParsePushedAuthorizationRequestResult
    // FIXME: export type
    request: VerifyPushedAuthorizationRequestOptions['request']
  }
) {
  const { issuanceSession, parsedAuthorizationRequest, issuer, request } = options
  const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
  const config = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)
  const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
  const authorizationServer = openId4VcIssuerService.getOauth2AuthorizationServer(agentContext, {
    issuanceSessionId: issuanceSession.id,
  })

  if (!parsedAuthorizationRequest.authorizationRequest.scope) {
    throw new Oauth2ServerErrorResponseError({
      error: Oauth2ErrorCodes.InvalidScope,
      error_description: `Missing required 'scope' parameter`,
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

  if (dpop)
    // Bind dpop jwk thumbprint to session
    issuanceSession.dpop = {
      // If dpop is provided at the start, it's required from now on.
      required: true,
      dpopJkt: dpop.jwkThumbprint,
    }
  if (clientAttestation)
    issuanceSession.walletAttestation = {
      // If dpop is provided at the start, it's required from now on.
      required: true,
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

  // Need to dynamically create an authorization request here
  // - call an externally configured OAuth2 server (adapt authorization servers?)
  //   - use client_id + client_secret -> other auth methods possible in future
  //   - start without PAR, DPoP, PKCE add support for it in follw up iteration
  // - construct an authorization request url based on auth server metadata
  // - include a state parameter
  // - return that url in this method
  // - user opens browser/auth session and sign in with the external IDP
  // - user is then redirected to our redirect url (which is whitelisted at the IDP)

  // credo config
  // - configure an external auth provider
  //  - client_id
  //  - client_secret
  //  - creates an id and redirectUri

  // - new endpoint for the redirectUri
  //   - this should not be handled by credo, as it should render html
  //     - recommendation from google: handle it first on the server
  //       the redirect to html. That way we can handle the response in credo
  //       but then we redirect to an user configured html screen!
  //   - we should support a method that parses a response url

  const _clientSecret = '<add-client-secret>'
  const clientId = '267587518616-a9tod4me34h07jgmk6erm7htvfr630ru.apps.googleusercontent.com'
  const oauth2Client = openId4VcIssuerService.getOauth2Client(agentContext)

  // FIXME: this should handle null return value
  const authorizationServerMetadata = await oauth2Client.fetchAuthorizationServerMetadata('https://accounts.google.com')
  if (!authorizationServerMetadata) {
    throw new Error('')
  }

  const redirectUri = joinUriParts(config.baseUrl, ['redirect'])

  const identityBrokerState = utils.uuid()
  // TODO: store pkce
  const { authorizationRequestUrl /* dpop, pkce */ } = await oauth2Client.initiateAuthorization({
    authorizationServerMetadata,
    clientId,
    redirectUri,
    additionalRequestPayload: {
      state: identityBrokerState,
    },
    scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
  })

  issuanceSession.identityBrokering = {
    required: true,
    requestUriReferenceValue: utils.uuid(),
    identityBrokerAuthorizationRequestUrl: authorizationRequestUrl,
    // TODO: make configurable?
    requestUriExpiresAt: addSecondsToDate(new Date(), 60),

    identityBrokerState,
    // FIXME: should add state to authorization request in oid4vc-ts
    state: parsedAuthorizationRequest.authorizationRequest.state as string | undefined,
  }

  const { pushedAuthorizationResponse } = authorizationServer.createPushedAuthorizationResponse({
    expiresInSeconds: 60,
    requestUri: authorizationRequestUrl,
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

        const parseResult = authorizationServer.parsePushedAuthorizationRequest({
          authorizationRequest: request.body,
          request: requestLike,
        })

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

        const issuanceSession = await openId4VcIssuerService.findSingleIssuancSessionByQuery(agentContext, {
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
