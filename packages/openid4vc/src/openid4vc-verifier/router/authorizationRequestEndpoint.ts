import { joinUriParts } from '@credo-ts/core'
import type { Response, Router } from 'express'
import {
  getRequestContext,
  sendErrorResponse,
  sendNotFoundResponse,
  sendUnknownServerErrorResponse,
} from '../../shared/router'
import { OpenId4VcVerificationSessionState } from '../OpenId4VcVerificationSessionState'
import { OpenId4VcVerifierModuleConfig } from '../OpenId4VcVerifierModuleConfig'
import { OpenId4VpVerifierService } from '../OpenId4VpVerifierService'
import type { OpenId4VcVerificationRequest } from './requestContext'

export function configureAuthorizationRequestEndpoint(router: Router, config: OpenId4VcVerifierModuleConfig) {
  router.get(
    joinUriParts(config.authorizationRequestEndpoint, [':authorizationRequestId']),
    async (request: OpenId4VcVerificationRequest, response: Response, next) => {
      const { agentContext, verifier } = getRequestContext(request)

      if (!request.params.authorizationRequestId || typeof request.params.authorizationRequestId !== 'string') {
        return sendErrorResponse(
          response,
          next,
          agentContext.config.logger,
          400,
          'invalid_request',
          'Invalid authorization request url'
        )
      }

      try {
        const verifierService = agentContext.dependencyManager.resolve(OpenId4VpVerifierService)
        const verifierConfig = agentContext.dependencyManager.resolve(OpenId4VcVerifierModuleConfig)

        // We always use shortened URIs currently
        const fullAuthorizationRequestUri = joinUriParts(verifierConfig.baseUrl, [
          verifier.verifierId,
          verifierConfig.authorizationRequestEndpoint,
          request.params.authorizationRequestId,
        ])

        const [verificationSession] = await verifierService.findVerificationSessionsByQuery(agentContext, {
          verifierId: verifier.verifierId,
          $or: [
            {
              authorizationRequestId: request.params.authorizationRequestId,
            },
            // NOTE: this can soon be removed, authorization request id is cleaner,
            // but only introduced since 0.6
            {
              authorizationRequestUri: fullAuthorizationRequestUri,
            },
          ],
        })

        // Not all requets are signed, and those are not fetcheable
        if (!verificationSession || !verificationSession.authorizationRequestJwt) {
          return sendErrorResponse(
            response,
            next,
            agentContext.config.logger,
            404,
            'not_found',
            'Authorization request not found'
          )
        }

        if (
          ![
            OpenId4VcVerificationSessionState.RequestCreated,
            OpenId4VcVerificationSessionState.RequestUriRetrieved,
          ].includes(verificationSession.state)
        ) {
          return sendErrorResponse(
            response,
            next,
            agentContext.config.logger,
            400,
            'invalid_request',
            'Invalid state for authorization request'
          )
        }

        if (verificationSession.expiresAt && Date.now() > verificationSession.expiresAt.getTime()) {
          return sendNotFoundResponse(response, next, agentContext.config.logger, 'Session expired')
        }

        // It's okay to retrieve the offer multiple times. So we only update the state if it's not already retrieved
        if (verificationSession.state !== OpenId4VcVerificationSessionState.RequestUriRetrieved) {
          await verifierService.updateState(
            agentContext,
            verificationSession,
            OpenId4VcVerificationSessionState.RequestUriRetrieved
          )
        }

        response.type('application/oauth-authz-req+jwt').status(200).send(verificationSession.authorizationRequestJwt)
        next()
      } catch (error) {
        return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error)
      }
    }
  )
}
