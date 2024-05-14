import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { OpenId4VcIssuanceSessionStateChangedEvent } from '../OpenId4VcIssuerEvents'
import type { Router, Response } from 'express'

import { joinUriParts, EventEmitter } from '@credo-ts/core'

import { getRequestContext, sendErrorResponse } from '../../shared/router'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuerEvents } from '../OpenId4VcIssuerEvents'
import { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { OpenId4VcIssuanceSessionRepository } from '../repository'

export interface OpenId4VciCredentialOfferEndpointConfig {
  /**
   * The path at which the credential offer should should be made available. Note that it will be
   * hosted at a subpath to take into account multiple tenants and issuers.
   *
   * @default /offers
   */
  endpointPath: string
}

export function configureCredentialOfferEndpoint(router: Router, config: OpenId4VciCredentialOfferEndpointConfig) {
  router.get(
    joinUriParts(config.endpointPath, [':credentialOfferId']),
    async (request: OpenId4VcIssuanceRequest, response: Response, next) => {
      const { agentContext, issuer } = getRequestContext(request)

      if (!request.params.credentialOfferId || typeof request.params.credentialOfferId !== 'string') {
        return sendErrorResponse(
          response,
          agentContext.config.logger,
          400,
          'invalid_request',
          'Invalid credential offer url'
        )
      }

      try {
        const issuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
        const issuerMetadata = issuerService.getIssuerMetadata(agentContext, issuer)
        const openId4VcIssuanceSessionRepository = agentContext.dependencyManager.resolve(
          OpenId4VcIssuanceSessionRepository
        )
        const issuerConfig = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)

        const fullCredentialOfferUri = joinUriParts(issuerMetadata.issuerUrl, [
          issuerConfig.credentialOfferEndpoint.endpointPath,
          request.params.credentialOfferId,
        ])

        const openId4VcIssuanceSession = await openId4VcIssuanceSessionRepository.findSingleByQuery(agentContext, {
          issuerId: issuer.issuerId,
          credentialOfferUri: fullCredentialOfferUri,
        })

        if (!openId4VcIssuanceSession || !openId4VcIssuanceSession.credentialOfferPayload) {
          return sendErrorResponse(response, agentContext.config.logger, 404, 'not_found', 'Credential offer not found')
        }

        if (
          ![OpenId4VcIssuanceSessionState.OfferCreated, OpenId4VcIssuanceSessionState.OfferUriRetrieved].includes(
            openId4VcIssuanceSession.state
          )
        ) {
          return sendErrorResponse(
            response,
            agentContext.config.logger,
            400,
            'invalid_request',
            'Invalid state for credential offer'
          )
        }

        // It's okay to retrieve the offer multiple times. So we only update the state if it's not already retrieved
        if (openId4VcIssuanceSession.state !== OpenId4VcIssuanceSessionState.OfferUriRetrieved) {
          const previousState = openId4VcIssuanceSession.state

          openId4VcIssuanceSession.state = OpenId4VcIssuanceSessionState.OfferUriRetrieved
          await openId4VcIssuanceSessionRepository.update(agentContext, openId4VcIssuanceSession)

          agentContext.dependencyManager
            .resolve(EventEmitter)
            .emit<OpenId4VcIssuanceSessionStateChangedEvent>(agentContext, {
              type: OpenId4VcIssuerEvents.IssuanceSessionStateChanged,
              payload: {
                issuanceSession: openId4VcIssuanceSession.clone(),
                previousState,
              },
            })
        }

        response.json(openId4VcIssuanceSession.credentialOfferPayload)
      } catch (error) {
        sendErrorResponse(response, agentContext.config.logger, 500, 'invalid_request', error)
      }

      // NOTE: if we don't call next, the agentContext session handler will NOT be called
      next()
    }
  )
}
