import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import type { HttpMethod } from '@animo-id/oauth2'
import type { Router, Response } from 'express'

import { Oauth2ErrorCodes, Oauth2ServerErrorResponseError, Oauth2ResourceUnauthorizedError } from '@animo-id/oauth2'
import { getCredentialConfigurationsMatchingRequestFormat } from '@animo-id/oid4vci'
import { joinUriParts } from '@credo-ts/core'

import { getCredentialConfigurationsSupportedForScopes } from '../../shared'
import {
  getRequestContext,
  sendJsonResponse,
  sendOauth2ErrorResponse,
  sendUnauthorizedError,
  sendUnknownServerErrorResponse,
} from '../../shared/router'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { OpenId4VcIssuanceSessionRecord, OpenId4VcIssuanceSessionRepository } from '../repository'

export function configureCredentialEndpoint(router: Router, config: OpenId4VcIssuerModuleConfig) {
  router.post(config.credentialEndpointPath, async (request: OpenId4VcIssuanceRequest, response: Response, next) => {
    const { agentContext, issuer } = getRequestContext(request)
    const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
    // TODO: we should allow delaying fetching auth metadata until it's needed
    // also we should cache it. (both request and response)
    const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer, true)
    const vcIssuer = await openId4VcIssuerService.getIssuer(agentContext)
    const resourceServer = openId4VcIssuerService.getResourceServer(agentContext, issuer)

    const fullRequestUrl = joinUriParts(issuerMetadata.credentialIssuer.credential_issuer, [
      config.credentialEndpointPath,
    ])
    const resourceRequestResult = await resourceServer
      .verifyResourceRequest({
        authorizationServers: issuerMetadata.authorizationServers,
        resourceServer: issuerMetadata.credentialIssuer.credential_issuer,
        request: {
          // FIXME: we need to make the input type here easier
          headers: new Headers(request.headers as Record<string, string>),
          method: request.method as HttpMethod,
          url: fullRequestUrl,
        },
      })
      .catch((error) => {
        sendUnauthorizedError(response, next, agentContext.config.logger, error)
      })
    if (!resourceRequestResult) return
    const { tokenPayload, dpopJwk, accessToken, scheme, authorizationServer } = resourceRequestResult

    const credentialRequest = request.body
    const issuanceSessionRepository = agentContext.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)

    const preAuthorizedCode =
      typeof tokenPayload['pre-authorized_code'] === 'string' ? tokenPayload['pre-authorized_code'] : undefined
    const issuerState = typeof tokenPayload.issuer_state === 'string' ? tokenPayload.issuer_state : undefined
    let issuanceSession = await issuanceSessionRepository.findSingleByQuery(agentContext, {
      issuerId: issuer.issuerId,
      preAuthorizedCode,

      // TODO: we should bind the issuance session to the `sub` of this token
      // after we've matched it against the issuer_state, otherwise someone can
      // get hold of an access token by providing an issuer_state value used in previous
      // sessions from someone else and hijack the session
      issuerState,
    })

    const parsedCredentialRequest = vcIssuer.parseCredentialRequest({
      credentialRequest,
    })

    if (!issuanceSession && !preAuthorizedCode && !issuerState && parsedCredentialRequest.format) {
      agentContext.config.logger.warn(
        `No issuance session found for incoming credential request for issuer ${issuer.issuerId} and access token data has no issuer_state or pre-authorized_code. Creating on-demand issuance session`,
        {
          tokenPayload,
        }
      )

      // All credential configurations that match the request scope and credential request
      // This is just so we don't create an issuance session that will fail immediately after
      const credentialConfigurationsForToken = getCredentialConfigurationsMatchingRequestFormat({
        credentialConfigurations: getCredentialConfigurationsSupportedForScopes(
          issuerMetadata.credentialIssuer.credential_configurations_supported,
          tokenPayload.scope?.split(' ') ?? []
        ),
        requestFormat: parsedCredentialRequest.format,
      })

      if (Object.keys(credentialConfigurationsForToken).length === 0) {
        return sendUnauthorizedError(
          response,
          next,
          agentContext.config.logger,
          new Oauth2ResourceUnauthorizedError(
            'No credential configurationss match credential request and access token scope',
            {
              scheme,
              error: Oauth2ErrorCodes.InsufficientScope,
            }
          ),
          // Forbidden for InsufficientScope
          403
        )
      }

      issuanceSession = new OpenId4VcIssuanceSessionRecord({
        credentialOfferPayload: {
          credential_configuration_ids: Object.keys(credentialConfigurationsForToken),
          credential_issuer: issuerMetadata.credentialIssuer.credential_issuer,
        },
        issuerId: issuer.issuerId,
        state: OpenId4VcIssuanceSessionState.CredentialRequestReceived,
        dpopRequired: dpopJwk !== undefined,
        clientId: tokenPayload.client_id,
      })

      // Save and update
      await issuanceSessionRepository.save(agentContext, issuanceSession)
      openId4VcIssuerService.emitStateChangedEvent(agentContext, issuanceSession, null)
    } else if (!issuanceSession) {
      agentContext.config.logger.warn(
        `No issuance session found for incoming credential request for issuer ${
          issuer.issuerId
        } but access token data has no ${
          issuerState ? 'issuer_state' : 'pre-authorized_code'
        }. Returning error response`,
        {
          tokenPayload,
        }
      )

      return sendOauth2ErrorResponse(
        response,
        next,
        agentContext.config.logger,
        new Oauth2ServerErrorResponseError(
          {
            error: Oauth2ErrorCodes.CredentialRequestDenied,
          },
          {
            internalMessage: `No issuance session found for incoming credential request for issuer ${issuer.issuerId} and access token data`,
          }
        )
      )
    }

    try {
      const { credentialResponse } = await openId4VcIssuerService.createCredentialResponse(agentContext, {
        issuanceSession,
        credentialRequest,
        authorization: {
          authorizationServer,
          accessToken: {
            payload: tokenPayload,
            value: accessToken,
          },
        },
      })

      return sendJsonResponse(response, next, credentialResponse)
    } catch (error) {
      if (error instanceof Oauth2ServerErrorResponseError) {
        return sendOauth2ErrorResponse(response, next, agentContext.config.logger, error)
      }
      if (error instanceof Oauth2ResourceUnauthorizedError) {
        return sendUnauthorizedError(response, next, agentContext.config.logger, error)
      }

      return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error)
    }
  })
}
