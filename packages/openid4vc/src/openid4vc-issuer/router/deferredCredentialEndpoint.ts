import type { HttpMethod } from '@openid4vc/oauth2'
import type { Response, Router } from 'express'
import type { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import type { OpenId4VcIssuanceRequest } from './requestContext'

import { joinUriParts } from '@credo-ts/core'
import { Oauth2ErrorCodes, Oauth2ResourceUnauthorizedError, Oauth2ServerErrorResponseError } from '@openid4vc/oauth2'
import { addSecondsToDate } from '@openid4vc/utils'
import {
  getRequestContext,
  sendJsonResponse,
  sendOauth2ErrorResponse,
  sendUnauthorizedError,
  sendUnknownServerErrorResponse,
} from '../../shared/router'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { OpenId4VcIssuanceSessionRepository } from '../repository'

export function configureDeferredCredentialEndpoint(router: Router, config: OpenId4VcIssuerModuleConfig) {
  router.post(
    config.deferredCredentialEndpointPath,
    async (request: OpenId4VcIssuanceRequest, response: Response, next) => {
      const { agentContext, issuer } = getRequestContext(request)
      const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
      const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer, true)
      const vcIssuer = openId4VcIssuerService.getIssuer(agentContext)
      const resourceServer = openId4VcIssuerService.getResourceServer(agentContext, issuer)

      const fullRequestUrl = joinUriParts(issuerMetadata.credentialIssuer.credential_issuer, [
        config.deferredCredentialEndpointPath,
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
          sendUnauthorizedError(response, next, agentContext.config.logger, error)
        })

      if (!resourceRequestResult) return
      const { tokenPayload, accessToken, scheme, authorizationServer } = resourceRequestResult

      const deferredCredentialRequest = request.body
      const issuanceSessionRepository = agentContext.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)

      const parsedCredentialRequest = vcIssuer.parseDeferredCredentialRequest({
        deferredCredentialRequest,
      })

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

      if (!issuerState && !preAuthorizedCode) {
        return sendOauth2ErrorResponse(
          response,
          next,
          agentContext.config.logger,
          new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidRequest,
            },
            {
              internalMessage: `Received deferred credential request without 'pre-authorized_code' or 'issuer_state' claim. At least one of these claims is required to identify the issuance session`,
            }
          )
        )
      }

      const issuanceSession = await issuanceSessionRepository.findSingleByQuery(agentContext, {
        preAuthorizedCode,
        issuerState,
      })

      if (
        !issuanceSession ||
        !issuanceSession.transactions?.find(
          (tx) => tx.transactionId === parsedCredentialRequest.deferredCredentialRequest.transaction_id
        )
      ) {
        agentContext.config.logger.warn(
          `No issuance session found for incoming deferred credential request for issuer ${
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
              error: Oauth2ErrorCodes.InvalidTransactionId,
            },
            {
              internalMessage: `No issuance session found for incoming credential request for issuer ${issuer.issuerId}, access token data and transaction id`,
            }
          )
        )
      }

      // Use issuance session dpop config
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

      // Verify the issuance session subject
      if (issuanceSession.authorization?.subject && issuanceSession.authorization.subject !== tokenPayload.sub) {
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

      const expiresAt =
        issuanceSession.expiresAt ??
        addSecondsToDate(issuanceSession.createdAt, config.statefulCredentialOfferExpirationInSeconds)

      if (Date.now() > expiresAt.getTime()) {
        issuanceSession.errorMessage = 'Credential offer has expired'
        await openId4VcIssuerService.updateState(agentContext, issuanceSession, OpenId4VcIssuanceSessionState.Error)
        throw new Oauth2ServerErrorResponseError({
          // What is the best error here?
          error: Oauth2ErrorCodes.CredentialRequestDenied,
          error_description: 'Session expired',
        })
      }

      try {
        const { deferredCredentialResponse } = await openId4VcIssuerService.createDeferredCredentialResponse(
          agentContext,
          {
            issuanceSession,
            deferredCredentialRequest: parsedCredentialRequest.deferredCredentialRequest,
            authorization: {
              authorizationServer,
              accessToken: {
                payload: tokenPayload,
                value: accessToken,
              },
            },
          }
        )

        return sendJsonResponse(
          response,
          next,
          deferredCredentialResponse,
          undefined,
          deferredCredentialResponse.interval ? 202 : 200
        )
      } catch (error) {
        if (error instanceof Oauth2ServerErrorResponseError) {
          return sendOauth2ErrorResponse(response, next, agentContext.config.logger, error)
        }
        if (error instanceof Oauth2ResourceUnauthorizedError) {
          return sendUnauthorizedError(response, next, agentContext.config.logger, error)
        }

        return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error)
      }
    }
  )
}
