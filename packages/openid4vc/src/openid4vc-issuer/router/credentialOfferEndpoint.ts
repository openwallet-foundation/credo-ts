import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { Router, Response } from 'express'

import { joinUriParts } from '@credo-ts/core'

import {
  getRequestContext,
  sendErrorResponse,
  sendJsonResponse,
  sendNotFoundResponse,
  sendUnknownServerErrorResponse,
} from '../../shared/router'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
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
          next,
          agentContext.config.logger,
          400,
          'invalid_request',
          'Invalid credential offer url'
        )
      }

      try {
        const issuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
        const issuerMetadata = await issuerService.getIssuerMetadata(agentContext, issuer)
        const openId4VcIssuanceSessionRepository = agentContext.dependencyManager.resolve(
          OpenId4VcIssuanceSessionRepository
        )
        const issuerConfig = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)

        const fullCredentialOfferUri = joinUriParts(issuerMetadata.credentialIssuer.credential_issuer, [
          issuerConfig.credentialOfferEndpoint.endpointPath,
          request.params.credentialOfferId,
        ])

        const openId4VcIssuanceSession = await openId4VcIssuanceSessionRepository.findSingleByQuery(agentContext, {
          issuerId: issuer.issuerId,
          credentialOfferUri: fullCredentialOfferUri,
        })
        if (!openId4VcIssuanceSession) {
          return sendNotFoundResponse(response, next, agentContext.config.logger, 'Credential offer not found')
        }

        if (
          openId4VcIssuanceSession.state !== OpenId4VcIssuanceSessionState.OfferCreated &&
          openId4VcIssuanceSession.state !== OpenId4VcIssuanceSessionState.OfferUriRetrieved
        ) {
          return sendNotFoundResponse(response, next, agentContext.config.logger, 'Invalid state for credential offer')
        }

        // It's okay to retrieve the offer multiple times. So we only update the state if it's not already retrieved
        if (openId4VcIssuanceSession.state !== OpenId4VcIssuanceSessionState.OfferUriRetrieved) {
          await issuerService.updateState(
            agentContext,
            openId4VcIssuanceSession,
            OpenId4VcIssuanceSessionState.OfferUriRetrieved
          )
        }

        return sendJsonResponse(response, next, openId4VcIssuanceSession.credentialOfferPayload)
      } catch (error) {
        return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error)
      }
    }
  )
}
