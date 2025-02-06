/*
 * Copyright 2025 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import type { OpenId4VciCredentialRequest, OpenId4VcIssuerModuleConfig } from '../../..'
import type { OpenId4VCIssuanceRequestContext } from '../router/requestContext'
import type * as http from 'node:http'

import {
  type HttpMethod,
  Oauth2ErrorCodes,
  Oauth2ResourceUnauthorizedError,
  Oauth2ServerErrorResponseError,
  SupportedAuthenticationScheme,
} from '@animo-id/oauth2'
import { getCredentialConfigurationsMatchingRequestFormat } from '@animo-id/oid4vci'
import { joinUriParts } from '@credo-ts/core'

import { getCredentialConfigurationsSupportedForScopes } from '../../shared'
import { addSecondsToDate } from '../../shared/utils'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import { OpenId4VcIssuanceSessionRecord, OpenId4VcIssuanceSessionRepository } from '../repository'

export function configureCredentialEndpointHandler(config: OpenId4VcIssuerModuleConfig) {
  return async function credentialEndpointHandler(
    credentialRequest: OpenId4VciCredentialRequest,
    httpRequest: http.IncomingMessage, // or use @animo-id/oauth2/RequestLike type
    { agentContext, issuer }: OpenId4VCIssuanceRequestContext
  ) {
    const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
    const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer, true)
    const vcIssuer = openId4VcIssuerService.getIssuer(agentContext)
    const resourceServer = openId4VcIssuerService.getResourceServer(agentContext, issuer)

    const fullRequestUrl = joinUriParts(issuerMetadata.credentialIssuer.credential_issuer, [
      config.credentialEndpointPath,
    ])
    const resourceRequestResult = await resourceServer.verifyResourceRequest({
      authorizationServers: issuerMetadata.authorizationServers,
      resourceServer: issuerMetadata.credentialIssuer.credential_issuer,
      allowedAuthenticationSchemes: config.dpopRequired ? [SupportedAuthenticationScheme.DPoP] : undefined,
      request: {
        headers: new Headers(httpRequest.headers as Record<string, string>),
        method: httpRequest.method as HttpMethod,
        url: fullRequestUrl,
      },
    })
    if (!resourceRequestResult) return null
    const { tokenPayload, accessToken, scheme, authorizationServer } = resourceRequestResult

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
      throw new Oauth2ServerErrorResponseError(
        {
          error: Oauth2ErrorCodes.ServerError,
        },
        {
          internalMessage: `Received token without 'sub' claim. Subject is required for binding issuance session`,
        }
      )
    }

    // Already handle request without format. Simplifies next code sections
    if (!parsedCredentialRequest.format) {
      throw new Oauth2ServerErrorResponseError({
        error: parsedCredentialRequest.credentialIdentifier
          ? Oauth2ErrorCodes.InvalidCredentialRequest
          : Oauth2ErrorCodes.UnsupportedCredentialFormat,
        error_description: parsedCredentialRequest.credentialIdentifier
          ? `Credential request containing 'credential_identifier' not supported`
          : `Credential format '${parsedCredentialRequest.credentialRequest.format}' not supported`,
      })
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

        throw new Oauth2ServerErrorResponseError(
          {
            error: Oauth2ErrorCodes.CredentialRequestDenied,
          },
          {
            internalMessage: `No issuance session found for incoming credential request for issuer ${issuer.issuerId} and access token data`,
          }
        )
      }

      // Verify the issuance session subject
      if (issuanceSession.authorization?.subject) {
        if (issuanceSession.authorization.subject !== tokenPayload.sub) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.CredentialRequestDenied,
            },
            {
              internalMessage: `Issuance session authorization subject does not match with the token payload subject for issuance session '${issuanceSession.id}'. Returning error response`,
            }
          )
        }
      }
      // Statefull session expired
      else if (
        Date.now() >
        addSecondsToDate(issuanceSession.createdAt, config.statefullCredentialOfferExpirationInSeconds).getTime()
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
        throw new Oauth2ResourceUnauthorizedError(
          'No credential configurationss match credential request and access token scope',
          {
            scheme,
            error: Oauth2ErrorCodes.InsufficientScope,
          }
        )
      }

      issuanceSession = new OpenId4VcIssuanceSessionRecord({
        credentialOfferPayload: {
          credential_configuration_ids: Object.keys(credentialConfigurationsForToken),
          credential_issuer: issuerMetadata.credentialIssuer.credential_issuer,
        },
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
      throw new Oauth2ServerErrorResponseError(
        {
          error: Oauth2ErrorCodes.CredentialRequestDenied,
        },
        {
          internalMessage: `Access token without 'issuer_state' or 'pre-authorized_code' issued by external authorization server provided, but 'allowDynamicIssuanceSessions' is disabled. Either bind the access token to a statefull credential offer, or enable 'allowDynamicIssuanceSessions'.`,
        }
      )
    }

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
  }
}
