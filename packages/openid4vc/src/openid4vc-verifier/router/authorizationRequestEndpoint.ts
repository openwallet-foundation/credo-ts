import type { OpenId4VcVerificationRequest } from './requestContext'
import type { OpenId4VcVerificationSessionStateChangedEvent } from '../OpenId4VcVerifierEvents'
import type { Router, Response } from 'express'

import { EventEmitter, joinUriParts } from '@credo-ts/core'

import { getRequestContext, sendErrorResponse } from '../../shared/router'
import { OpenId4VcSiopVerifierService } from '../OpenId4VcSiopVerifierService'
import { OpenId4VcVerificationSessionState } from '../OpenId4VcVerificationSessionState'
import { OpenId4VcVerifierEvents } from '../OpenId4VcVerifierEvents'
import { OpenId4VcVerifierModuleConfig } from '../OpenId4VcVerifierModuleConfig'
import { OpenId4VcVerificationSessionRepository } from '../repository'

export interface OpenId4VcSiopAuthorizationRequestEndpointConfig {
  /**
   * The path at which the authorization request should be made available. Note that it will be
   * hosted at a subpath to take into account multiple tenants and verifiers.
   *
   * @default /authorization-requests
   */
  endpointPath: string
}

export function configureAuthorizationRequestEndpoint(
  router: Router,
  config: OpenId4VcSiopAuthorizationRequestEndpointConfig
) {
  router.get(
    joinUriParts(config.endpointPath, [':authorizationRequestId']),
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
        const verifierService = agentContext.dependencyManager.resolve(OpenId4VcSiopVerifierService)
        const verificationSessionRepository = agentContext.dependencyManager.resolve(
          OpenId4VcVerificationSessionRepository
        )
        const verifierConfig = agentContext.dependencyManager.resolve(OpenId4VcVerifierModuleConfig)

        // We always use shortened URIs currently
        const fullAuthorizationRequestUri = joinUriParts(verifierConfig.baseUrl, [
          verifier.verifierId,
          verifierConfig.authorizationRequestEndpoint.endpointPath,
          request.params.authorizationRequestId,
        ])

        const [verificationSession] = await verifierService.findVerificationSessionsByQuery(agentContext, {
          verifierId: verifier.verifierId,
          authorizationRequestUri: fullAuthorizationRequestUri,
        })

        if (!verificationSession) {
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

        // It's okay to retrieve the offer multiple times. So we only update the state if it's not already retrieved
        if (verificationSession.state !== OpenId4VcVerificationSessionState.RequestUriRetrieved) {
          const previousState = verificationSession.state

          verificationSession.state = OpenId4VcVerificationSessionState.RequestUriRetrieved
          await verificationSessionRepository.update(agentContext, verificationSession)

          agentContext.dependencyManager
            .resolve(EventEmitter)
            .emit<OpenId4VcVerificationSessionStateChangedEvent>(agentContext, {
              type: OpenId4VcVerifierEvents.VerificationSessionStateChanged,
              payload: {
                verificationSession: verificationSession.clone(),
                previousState,
              },
            })
        }

        response.type('application/oauth-authz-req+jwt').status(200).send(verificationSession.authorizationRequestJwt)
        next()
      } catch (error) {
        return sendErrorResponse(response, next, agentContext.config.logger, 500, 'invalid_request', error)
      }
    }
  )
}
