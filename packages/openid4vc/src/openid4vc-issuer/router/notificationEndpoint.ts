import { joinUriParts } from '@credo-ts/core'
import type { HttpMethod } from '@openid4vc/oauth2'
import { Oauth2ErrorCodes, Oauth2ResourceUnauthorizedError, Oauth2ServerErrorResponseError } from '@openid4vc/oauth2'
import type { Response, Router } from 'express'
import {
  getRequestContext,
  sendOauth2ErrorResponse,
  sendUnauthorizedError,
  sendUnknownServerErrorResponse,
} from '../../shared/router'
import type { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { OpenId4VcIssuanceSessionRepository } from '../repository'
import type { OpenId4VcIssuanceRequest } from './requestContext'

export function configureNotificationEndpoint(router: Router, config: OpenId4VcIssuerModuleConfig) {
  router.post(config.notificationEndpointPath, async (request: OpenId4VcIssuanceRequest, response: Response, next) => {
    const { agentContext, issuer } = getRequestContext(request)
    const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
    const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer, true)
    const vcIssuer = openId4VcIssuerService.getIssuer(agentContext)
    const resourceServer = openId4VcIssuerService.getResourceServer(agentContext, issuer, issuerMetadata)

    const fullRequestUrl = joinUriParts(issuerMetadata.credentialIssuer.credential_issuer, [
      config.notificationEndpointPath,
    ])

    const resourceRequestResult = await resourceServer
      .verifyResourceRequest({
        authorizationServers: issuerMetadata.authorizationServers,
        resourceServer: issuerMetadata.credentialIssuer.credential_issuer,
        request: {
          headers: new Headers(request.headers as Record<string, string>),
          method: request.method as HttpMethod,
          url: fullRequestUrl,
        },
      })
      .catch((error) => {
        // Only a rejected token or DPoP proof is a client error, anything else (e.g. a misconfigured resource server) is ours
        if (error instanceof Oauth2ResourceUnauthorizedError) {
          sendUnauthorizedError(response, next, agentContext.config.logger, error)
        } else {
          sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error)
        }
      })

    if (!resourceRequestResult) return
    const { tokenPayload, scheme } = resourceRequestResult

    let notificationRequest: ReturnType<typeof vcIssuer.parseNotificationRequest>['notificationRequest']
    try {
      notificationRequest = vcIssuer.parseNotificationRequest({
        notificationRequest: request.body,
      }).notificationRequest
    } catch (error) {
      if (error instanceof Oauth2ServerErrorResponseError) {
        return sendOauth2ErrorResponse(response, next, agentContext.config.logger, error)
      }
      return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error)
    }

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

    // The credential endpoint binds the token subject to the issuance session before it issues credentials.
    // For dynamic issuance sessions created for external authorization servers it may occur that multiple
    // sessions use the same "sub", we include the notification id in the query, but a wallet could
    // link cross-session in this case. The same "sub" means the same user, and the authorization server
    // is trusted. It's the responsiblity of the autohrization server to use fresh "sub" values, or allow
    // the cross-session linking.
    const issuanceSessionRepository = agentContext.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
    const issuanceSession = await issuanceSessionRepository.findSingleByQuery(agentContext, {
      issuerId: issuer.issuerId,
      notificationIds: [notificationRequest.notification_id],
      authorizationSubject: subject,
      preAuthorizedCode:
        typeof tokenPayload['pre-authorized_code'] === 'string' ? tokenPayload['pre-authorized_code'] : undefined,
      issuerState: typeof tokenPayload.issuer_state === 'string' ? tokenPayload.issuer_state : undefined,
    })

    if (!issuanceSession) {
      return sendOauth2ErrorResponse(
        response,
        next,
        agentContext.config.logger,
        new Oauth2ServerErrorResponseError(
          {
            error: Oauth2ErrorCodes.InvalidNotificationId,
          },
          {
            internalMessage: `No issuance session found for incoming notification request for issuer ${issuer.issuerId}, access token data and notification id`,
          }
        )
      )
    }

    // verifyResourceRequest already requires a proof for DPoP-bound tokens, so this catches bearer tokens from an external authorization server
    if (issuanceSession.dpop?.required && !resourceRequestResult.dpop) {
      return sendUnauthorizedError(
        response,
        next,
        agentContext.config.logger,
        new Oauth2ResourceUnauthorizedError('Missing required DPoP proof', {
          scheme,
          error: Oauth2ErrorCodes.InvalidDpopProof,
        })
      )
    }

    try {
      await openId4VcIssuerService.receiveNotification(agentContext, {
        issuanceSession,
        notificationId: notificationRequest.notification_id,
        event: notificationRequest.event,
        eventDescription: notificationRequest.event_description,
      })

      response.status(204).send()
      return next()
    } catch (error) {
      if (error instanceof Oauth2ServerErrorResponseError) {
        return sendOauth2ErrorResponse(response, next, agentContext.config.logger, error)
      }

      return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error)
    }
  })
}
