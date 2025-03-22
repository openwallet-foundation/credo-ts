import type { HttpMethod } from '@openid4vc/oauth2'
import type { Response, Router } from 'express'
import type { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import type { OpenId4VcIssuanceRequest } from './requestContext'

import { joinUriParts, utils } from '@credo-ts/core'
import {
  Oauth2ErrorCodes,
  Oauth2ResourceUnauthorizedError,
  Oauth2ServerErrorResponseError,
  SupportedAuthenticationScheme,
} from '@openid4vc/oauth2'
import { getCredentialConfigurationsMatchingRequestFormat } from '@openid4vc/openid4vci'

import { getCredentialConfigurationsSupportedForScopes } from '../../shared'
import {
  getRequestContext,
  sendJsonResponse,
  sendOauth2ErrorResponse,
  sendUnauthorizedError,
  sendUnknownServerErrorResponse,
} from '../../shared/router'
import { addSecondsToDate } from '../../shared/utils'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { OpenId4VcIssuanceSessionRecord, OpenId4VcIssuanceSessionRepository } from '../repository'

export function configureCredentialEndpoint(router: Router, config: OpenId4VcIssuerModuleConfig) {
  router.post(config.credentialEndpointPath, async (request: OpenId4VcIssuanceRequest, response: Response, next) => {
    const { agentContext, issuer } = getRequestContext(request)
    const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
    const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer, true)
    const vcIssuer = openId4VcIssuerService.getIssuer(agentContext)
    const resourceServer = openId4VcIssuerService.getResourceServer(agentContext, issuer)

    const fullRequestUrl = joinUriParts(issuerMetadata.credentialIssuer.credential_issuer, [
      config.credentialEndpointPath,
    ])
    const resourceRequestResult = await resourceServer
      .verifyResourceRequest({
        authorizationServers: issuerMetadata.authorizationServers,
        resourceServer: issuerMetadata.credentialIssuer.credential_issuer,
        allowedAuthenticationSchemes: config.dpopRequired ? [SupportedAuthenticationScheme.DPoP] : undefined,
        request: {
          headers: new Headers(request.headers as Record<string, string>),
          method: request.method as HttpMethod,
          url: fullRequestUrl,
        },
      })
      .catch((error) => {
        sendUnauthorizedError(response, next, agentContext.config.logger, error)
      })
    if (!resourceRequestResult) return
    const { tokenPayload, accessToken, scheme, authorizationServer } = resourceRequestResult

    const credentialRequest = request.body
    const issuanceSessionRepository = agentContext.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)

    const parsedCredentialRequest = vcIssuer.parseCredentialRequest({
      credentialRequest,
    })

    let issuanceSession: OpenId4VcIssuanceSessionRecord | null = null
    const preAuthorizedCode =
      typeof tokenPayload['pre-authorized_code'] === 'string' ? tokenPayload['pre-authorized_code'] : undefined
    const issuerState = typeof tokenPayload.issuer_state === 'string' ? tokenPayload.issuer_state : undefined

    const subject = tokenPayload.sub
    if (!subject) {
      return sendOauth2ErrorResponse(
        response,
        next,
        agentContext.config.logger,
        new Oauth2ServerErrorResponseError(
          {
            error: Oauth2ErrorCodes.ServerError,
          },
          {
            internalMessage: `Received token without 'sub' claim. Subject is required for binding issuance session`,
          }
        )
      )
    }

    // Already handle request without format. Simplifies next code sections
    if (!parsedCredentialRequest.format) {
      return sendOauth2ErrorResponse(
        response,
        next,
        agentContext.config.logger,
        new Oauth2ServerErrorResponseError({
          error: parsedCredentialRequest.credentialIdentifier
            ? Oauth2ErrorCodes.InvalidCredentialRequest
            : Oauth2ErrorCodes.UnsupportedCredentialFormat,
          error_description: parsedCredentialRequest.credentialIdentifier
            ? `Credential request containing 'credential_identifier' not supported`
            : `Credential format '${parsedCredentialRequest.credentialRequest.format}' not supported`,
        })
      )
    }

    if (preAuthorizedCode || issuerState) {
      issuanceSession = await issuanceSessionRepository.findSingleByQuery(agentContext, {
        issuerId: issuer.issuerId,
        preAuthorizedCode,
        issuerState,
      })

      if (!issuanceSession) {
        agentContext.config.logger.warn(
          `No issuance session found for incoming credential request for issuer ${
            issuer.issuerId
          } but access token data has ${
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

      // Verify the issuance session subject
      if (issuanceSession.authorization?.subject) {
        if (issuanceSession.authorization.subject !== tokenPayload.sub) {
          return sendOauth2ErrorResponse(
            response,
            next,
            agentContext.config.logger,
            new Oauth2ServerErrorResponseError(
              {
                error: Oauth2ErrorCodes.CredentialRequestDenied,
              },
              {
                internalMessage: `Issuance session authorization subject does not match with the token payload subject for issuance session '${issuanceSession.id}'. Returning error response`,
              }
            )
          )
        }
      }
      // Stateful session expired
      else if (
        Date.now() >
        addSecondsToDate(issuanceSession.createdAt, config.statefulCredentialOfferExpirationInSeconds).getTime()
      ) {
        issuanceSession.errorMessage = 'Credential offer has expired'
        await openId4VcIssuerService.updateState(agentContext, issuanceSession, OpenId4VcIssuanceSessionState.Error)
        throw new Oauth2ServerErrorResponseError({
          // What is the best error here?
          error: Oauth2ErrorCodes.CredentialRequestDenied,
          error_description: 'Session expired',
        })
      } else {
        issuanceSession.authorization = {
          ...issuanceSession.authorization,
          subject: tokenPayload.sub,
        }
        await issuanceSessionRepository.update(agentContext, issuanceSession)
      }
    }

    if (!issuanceSession && config.allowDynamicIssuanceSessions) {
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
        credentialOfferId: utils.uuid(),
        issuerId: issuer.issuerId,
        state: OpenId4VcIssuanceSessionState.CredentialRequestReceived,
        clientId: tokenPayload.client_id,
        authorization: {
          subject: tokenPayload.sub,
        },
      })

      // Save and update
      await issuanceSessionRepository.save(agentContext, issuanceSession)
      openId4VcIssuerService.emitStateChangedEvent(agentContext, issuanceSession, null)
    } else if (!issuanceSession) {
      return sendOauth2ErrorResponse(
        response,
        next,
        agentContext.config.logger,
        new Oauth2ServerErrorResponseError(
          {
            error: Oauth2ErrorCodes.CredentialRequestDenied,
          },
          {
            internalMessage: `Access token without 'issuer_state' or 'pre-authorized_code' issued by external authorization server provided, but 'allowDynamicIssuanceSessions' is disabled. Either bind the access token to a stateful credential offer, or enable 'allowDynamicIssuanceSessions'.`,
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
