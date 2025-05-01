import { HttpMethod, SupportedAuthenticationScheme } from '@openid4vc/oauth2'
import type { BaseOpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import type { OpenId4VcIssuancePostRequest } from './requestContext'

import { joinUriParts, utils } from '@credo-ts/core'
import { Oauth2ErrorCodes, Oauth2ResourceUnauthorizedError, Oauth2ServerErrorResponseError } from '@openid4vc/oauth2'
import {
  CredentialConfigurationsSupportedWithFormats,
  CredentialRequest,
  getCredentialConfigurationsMatchingRequestFormat,
} from '@openid4vc/openid4vci'
import createHttpError from 'http-errors'
import { getCredentialConfigurationsSupportedForScopes } from '../../shared'
import { CredoRouter, getRequestContext } from '../../shared/router'
import { addSecondsToDate } from '../../shared/utils'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { OpenId4VcIssuanceSessionRecord, OpenId4VcIssuanceSessionRepository } from '../repository'
import { oauth2Error, oauth2UnauthorizedError } from '../util/errors'

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
        request: {
          headers: new Headers(request.headers as Record<string, string>),
          method: request.method as HttpMethod,
          url: fullRequestUrl,
        },
      })
      .catch((error: unknown) => {
        throw error instanceof Oauth2ResourceUnauthorizedError
          ? oauth2UnauthorizedError(error.message, error.wwwAuthenticateHeaders)
          : oauth2UnauthorizedError('Unknown error occured', [
              { scheme: SupportedAuthenticationScheme.DPoP },
              { scheme: SupportedAuthenticationScheme.Bearer },
            ])
      })
    if (!resourceRequestResult) return
    const { tokenPayload, accessToken, scheme, authorizationServer } = resourceRequestResult

    const credentialRequest = request.body
    const issuanceSessionRepository = agentContext.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)

    const parsedCredentialRequest = vcIssuer.parseCredentialRequest({
      credentialRequest,
      issuerMetadata,
    })

    let issuanceSession: OpenId4VcIssuanceSessionRecord | null = null
    const preAuthorizedCode =
      typeof tokenPayload['pre-authorized_code'] === 'string' ? tokenPayload['pre-authorized_code'] : undefined
    const issuerState = typeof tokenPayload.issuer_state === 'string' ? tokenPayload.issuer_state : undefined

    const subject = tokenPayload.sub
    if (!subject) {
      throw oauth2Error(
        Oauth2ErrorCodes.ServerError,
        `Received token without 'sub' claim. Subject is required for binding issuance session`
      )
    }

    // Already handle request without format. Simplifies next code sections
    if (!parsedCredentialRequest.format) {
      throw parsedCredentialRequest.credentialIdentifier
        ? oauth2Error(
            Oauth2ErrorCodes.InvalidCredentialRequest,
            `Credential request containing 'credential_identifier' not supported`
          )
        : oauth2Error(
            Oauth2ErrorCodes.UnsupportedCredentialFormat,
            parsedCredentialRequest.credentialConfigurationId
              ? `Credential configuration '${parsedCredentialRequest.credentialConfigurationId}' not supported`
              : `Credential format '${parsedCredentialRequest.credentialRequest.format}' not supported`
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

        throw oauth2Error(
          Oauth2ErrorCodes.CredentialRequestDenied,
          `No issuance session found for incoming credential request for issuer ${issuer.issuerId} and access token data`
        )
      }

      // Use issuance session dpop config
      if (issuanceSession.dpop?.required && !resourceRequestResult.dpop) {
        return oauth2UnauthorizedError('Missing required DPoP proof', [
          {
            scheme,
            error: Oauth2ErrorCodes.InvalidDpopProof,
          },
        ])
      }

      // Verify the issuance session subject
      if (issuanceSession.authorization?.subject) {
        if (issuanceSession.authorization.subject !== tokenPayload.sub) {
          throw oauth2Error(
            Oauth2ErrorCodes.CredentialRequestDenied,
            `Issuance session authorization subject does not match with the token payload subject for issuance session '${issuanceSession.id}'. Returning error response`
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
        throw oauth2Error(Oauth2ErrorCodes.CredentialRequestDenied, 'Session expired')
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

      // Use global config when creating a dynamic session
      if (config.dpopRequired && !resourceRequestResult.dpop) {
        throw oauth2UnauthorizedError('Missing required DPoP proof', [
          {
            scheme: scheme,
            error: Oauth2ErrorCodes.InvalidDpopProof,
          },
        ])
      }

      const configurationsForScope = getCredentialConfigurationsSupportedForScopes(
        issuerMetadata.credentialIssuer.credential_configurations_supported,
        tokenPayload.scope?.split(' ') ?? []
      )

      // All credential configurations that match the request scope and credential request
      // This is just so we don't create an issuance session that will fail immediately after
      let configurationsForToken: CredentialConfigurationsSupportedWithFormats = {}

      if (parsedCredentialRequest.credentialConfigurationId && parsedCredentialRequest.credentialConfiguration) {
        if (configurationsForScope[parsedCredentialRequest.credentialConfigurationId]) {
          configurationsForToken = {
            [parsedCredentialRequest.credentialConfigurationId]: parsedCredentialRequest.credentialConfiguration,
          }
        }
      } else if (parsedCredentialRequest.format) {
        configurationsForToken = getCredentialConfigurationsMatchingRequestFormat({
          credentialConfigurations: configurationsForScope,
          requestFormat: parsedCredentialRequest.format,
        })
      }

      if (Object.keys(configurationsForToken).length === 0) {
        throw oauth2UnauthorizedError('No credential configurations match credential request and access token scope', [
          {
            scheme,
            error: Oauth2ErrorCodes.InsufficientScope,
          },
        ])
      }

      issuanceSession = new OpenId4VcIssuanceSessionRecord({
        credentialOfferPayload: {
          credential_configuration_ids: Object.keys(configurationsForToken),
          credential_issuer: issuerMetadata.credentialIssuer.credential_issuer,
        },
        credentialOfferId: utils.uuid(),
        issuerId: issuer.issuerId,
        state: OpenId4VcIssuanceSessionState.CredentialRequestReceived,
        clientId: tokenPayload.client_id,
        dpop: config.dpopRequired
          ? {
              required: true,
            }
          : undefined,
        authorization: {
          subject: tokenPayload.sub,
        },
      })

      // Save and update
      await issuanceSessionRepository.save(agentContext, issuanceSession)
      openId4VcIssuerService.emitStateChangedEvent(agentContext, issuanceSession, null)
    } else if (!issuanceSession) {
      throw oauth2Error(
        Oauth2ErrorCodes.CredentialRequestDenied,
        `Access token without 'issuer_state' or 'pre-authorized_code' issued by external authorization server provided, but 'allowDynamicIssuanceSessions' is disabled. Either bind the access token to a stateful credential offer, or enable 'allowDynamicIssuanceSessions'.`
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
