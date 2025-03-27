import type { HttpMethod } from '@openid4vc/oauth2'
import type { BaseOpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import type { OpenId4VcIssuancePostRequest } from './requestContext'

import { joinUriParts, utils } from '@credo-ts/core'
import {
  Oauth2ErrorCodes,
  Oauth2ResourceUnauthorizedError,
  Oauth2ServerErrorResponseError,
  SupportedAuthenticationScheme,
} from '@openid4vc/oauth2'
import { CredentialRequest, getCredentialConfigurationsMatchingRequestFormat } from '@openid4vc/openid4vci'

import createHttpError from 'http-errors'
import { getCredentialConfigurationsSupportedForScopes } from '../../shared'
import { CredoRouter, getRequestContext } from '../../shared/router'
import { addSecondsToDate } from '../../shared/utils'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { OpenId4VcIssuanceSessionRecord, OpenId4VcIssuanceSessionRepository } from '../repository'

export function configureCredentialEndpoint(router: CredoRouter, config: BaseOpenId4VcIssuerModuleConfig) {
  router.post(config.credentialEndpointPath, async (request: OpenId4VcIssuancePostRequest<CredentialRequest>) => {
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
      .catch((error: unknown) => {
        throw createHttpError(
          403,
          error instanceof Oauth2ResourceUnauthorizedError ? error.message : 'Unknown error occured',
          {
            headers: {
              'WWW-Authenticate':
                error instanceof Oauth2ResourceUnauthorizedError
                  ? error.toHeaderValue()
                  : new Oauth2ResourceUnauthorizedError(
                      'No credential configurations match credential request and access token scope',
                      [{ scheme: SupportedAuthenticationScheme.DPoP }, { scheme: SupportedAuthenticationScheme.Bearer }]
                    ).toHeaderValue(),
            },
          }
        )
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
      throw createHttpError(
        400,
        `Received token without 'sub' claim. Subject is required for binding issuance session`,
        {
          type: 'oauth2_error',
          errorResponse: { error: Oauth2ErrorCodes.ServerError },
        }
      )
    }

    // Already handle request without format. Simplifies next code sections
    if (!parsedCredentialRequest.format) {
      throw createHttpError(
        400,
        parsedCredentialRequest.credentialIdentifier
          ? `Credential request containing 'credential_identifier' not supported`
          : `Credential format '${parsedCredentialRequest.credentialRequest.format}' not supported`,
        {
          type: 'oauth2_error',
          errorResponse: {
            error: parsedCredentialRequest.credentialIdentifier
              ? Oauth2ErrorCodes.InvalidCredentialRequest
              : Oauth2ErrorCodes.UnsupportedCredentialFormat,
          },
        }
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

        throw createHttpError(
          400,
          `No issuance session found for incoming credential request for issuer ${issuer.issuerId} and access token data`,
          {
            type: 'oauth2_error',
            errorResponse: { error: Oauth2ErrorCodes.CredentialRequestDenied },
          }
        )
      }

      // Verify the issuance session subject
      if (issuanceSession.authorization?.subject) {
        if (issuanceSession.authorization.subject !== tokenPayload.sub) {
          throw createHttpError(
            400,
            `Issuance session authorization subject does not match with the token payload subject for issuance session '${issuanceSession.id}'. Returning error response`,
            {
              type: 'oauth2_error',
              errorResponse: { error: Oauth2ErrorCodes.CredentialRequestDenied },
            }
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
        throw createHttpError(400, 'Session expired', {
          type: 'oauth2_error',
          errorResponse: { error: Oauth2ErrorCodes.CredentialRequestDenied },
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
        throw createHttpError(403, 'No credential configurations match credential request and access token scope', {
          headers: {
            'WWW-Authenticate': new Oauth2ResourceUnauthorizedError(
              'No credential configurationss match credential request and access token scope',
              {
                scheme,
                error: Oauth2ErrorCodes.InsufficientScope,
              }
            ).toHeaderValue(),
          },
        })
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
      throw createHttpError(
        400,
        `Access token without 'issuer_state' or 'pre-authorized_code' issued by external authorization server provided, but 'allowDynamicIssuanceSessions' is disabled. Either bind the access token to a stateful credential offer, or enable 'allowDynamicIssuanceSessions'.`,
        {
          type: 'oauth2_error',
          errorResponse: { error: Oauth2ErrorCodes.CredentialRequestDenied },
        }
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

      return credentialResponse
    } catch (error) {
      if (error instanceof Oauth2ServerErrorResponseError) {
        throw createHttpError(400, error.message, { type: 'oauth2_error', errorResponse: error.errorResponse })
      }
      if (error instanceof Oauth2ResourceUnauthorizedError) {
        throw createHttpError(403, error.message, {})
      }

      throw createHttpError(500, error)
    }
  })
}
