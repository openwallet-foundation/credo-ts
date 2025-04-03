import type { AgentContext } from '@credo-ts/core'
import type {
  HttpMethod,
  ParseAuthorizationChallengeRequestOptions,
  ParseAuthorizationChallengeRequestResult,
} from '@openid4vc/oauth2'
import type { NextFunction, Response, Router } from 'express'
import type { OpenId4VciCredentialConfigurationsSupportedWithFormats } from '../../shared'
import type { OpenId4VcIssuerRecord } from '../repository'
import type { OpenId4VcIssuanceRequest } from './requestContext'

import { TypedArrayEncoder, joinUriParts } from '@credo-ts/core'
import { Oauth2ErrorCodes, Oauth2ServerErrorResponseError } from '@openid4vc/oauth2'

import {
  OpenId4VcVerificationSessionRepository,
  OpenId4VcVerificationSessionState,
  OpenId4VcVerifierApi,
} from '../../openid4vc-verifier'
import {
  getAllowedAndRequestedScopeValues,
  getCredentialConfigurationsSupportedForScopes,
  getOfferedCredentials,
  getScopesFromCredentialConfigurationsSupported,
} from '../../shared'
import {
  getRequestContext,
  sendJsonResponse,
  sendOauth2ErrorResponse,
  sendUnknownServerErrorResponse,
} from '../../shared/router'
import { addSecondsToDate } from '../../shared/utils'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'

export function configureAuthorizationChallengeEndpoint(router: Router, config: OpenId4VcIssuerModuleConfig) {
  router.post(
    config.authorizationChallengeEndpointPath,
    async (request: OpenId4VcIssuanceRequest, response: Response, next: NextFunction) => {
      const requestContext = getRequestContext(request)
      const { agentContext, issuer } = requestContext

      try {
        const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
        const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
        const authorizationServer = openId4VcIssuerService.getOauth2AuthorizationServer(agentContext)
        const fullRequestUrl = joinUriParts(issuerMetadata.credentialIssuer.credential_issuer, [
          config.authorizationChallengeEndpointPath,
        ])

        const requestLike = {
          headers: new Headers(request.headers as Record<string, string>),
          method: request.method as HttpMethod,
          url: fullRequestUrl,
        } as const

        const parseResult = authorizationServer.parseAuthorizationChallengeRequest({
          authorizationChallengeRequest: request.body,
          request: requestLike,
        })
        const { authorizationChallengeRequest } = parseResult

        if (authorizationChallengeRequest.auth_session) {
          await handleAuthorizationChallengeWithAuthSession({
            response,
            next,
            parseResult,
            request: requestLike,
            agentContext,
            issuer,
          })
        } else {
          // First call, no auth_sesion yet
          await handleAuthorizationChallengeNoAuthSession({
            agentContext,
            issuer,
            parseResult,
            request: requestLike,
          })
        }
      } catch (error) {
        if (error instanceof Oauth2ServerErrorResponseError) {
          return sendOauth2ErrorResponse(response, next, agentContext.config.logger, error)
        }
        return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error)
      }
    }
  )
}

async function handleAuthorizationChallengeNoAuthSession(options: {
  agentContext: AgentContext
  issuer: OpenId4VcIssuerRecord
  parseResult: ParseAuthorizationChallengeRequestResult
  // FIXME: export in oid4vc-ts
  request: ParseAuthorizationChallengeRequestOptions['request']
}) {
  const { agentContext, issuer, parseResult, request } = options
  const { authorizationChallengeRequest } = parseResult

  // First call, no auth_sesion yet

  const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
  const config = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)
  const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)

  if (!config.getVerificationSessionForIssuanceSessionAuthorization) {
    throw new Oauth2ServerErrorResponseError(
      {
        error: Oauth2ErrorCodes.ServerError,
      },
      {
        internalMessage: `Missing required 'getVerificationSessionForIssuanceSessionAuthorization' callback in openid4vc issuer module config. This callback is required for presentation during issuance flows.`,
      }
    )
  }

  if (!authorizationChallengeRequest.issuer_state) {
    throw new Oauth2ServerErrorResponseError({
      error: Oauth2ErrorCodes.InvalidRequest,
      error_description: `Missing required 'issuer_state' parameter. Only requests initiated by a credential offer are supported for authorization challenge.`,
    })
  }

  if (!authorizationChallengeRequest.scope) {
    throw new Oauth2ServerErrorResponseError({
      error: Oauth2ErrorCodes.InvalidScope,
      error_description: `Missing required 'scope' parameter`,
    })
  }

  const issuanceSession = await openId4VcIssuerService.findSingleIssuancSessionByQuery(agentContext, {
    issuerId: issuer.issuerId,
    issuerState: authorizationChallengeRequest.issuer_state,
  })
  const allowedStates = [OpenId4VcIssuanceSessionState.OfferCreated, OpenId4VcIssuanceSessionState.OfferUriRetrieved]
  if (!issuanceSession || !allowedStates.includes(issuanceSession.state)) {
    throw new Oauth2ServerErrorResponseError(
      {
        error: Oauth2ErrorCodes.InvalidRequest,
        error_description: `Invalid 'issuer_state' parameter`,
      },
      {
        internalMessage: !issuanceSession
          ? `Issuance session not found for 'issuer_state' parameter '${authorizationChallengeRequest.issuer_state}'`
          : `Issuance session '${issuanceSession.id}' has state '${
              issuanceSession.state
            }' but expected one of ${allowedStates.join(', ')}`,
      }
    )
  }

  const authorizationServer = openId4VcIssuerService.getOauth2AuthorizationServer(agentContext, {
    issuanceSessionId: issuanceSession.id,
  })
  const { clientAttestation, dpop } = await authorizationServer.verifyAuthorizationChallengeRequest({
    authorizationChallengeRequest,
    authorizationServerMetadata: issuerMetadata.authorizationServers[0],
    request,
    clientAttestation: {
      ...parseResult.clientAttestation,
      // First session config, fall back to global config
      required: issuanceSession.walletAttestation?.required ?? config.walletAttestationsRequired,
    },
    dpop: {
      ...parseResult.dpop,
      // First session config, fall back to global config
      required: issuanceSession.dpop?.required ?? config.dpopRequired,
    },
  })

  // Bind dpop jwk thumbprint to session
  if (dpop)
    issuanceSession.dpop = {
      // If dpop is provided at the start, it's required from now on.
      required: true,
      dpopJkt: dpop.jwkThumbprint,
    }
  if (clientAttestation)
    issuanceSession.walletAttestation = {
      // If dpop is provided at the start, it's required from now on.
      required: true,
    }

  const offeredCredentialConfigurations = getOfferedCredentials(
    issuanceSession.credentialOfferPayload.credential_configuration_ids,
    issuerMetadata.credentialIssuer.credential_configurations_supported
  )

  const allowedScopes = getScopesFromCredentialConfigurationsSupported(offeredCredentialConfigurations)
  const requestedScopes = getAllowedAndRequestedScopeValues({
    allowedScopes,
    requestedScope: authorizationChallengeRequest.scope,
  })
  const requestedCredentialConfigurations = getCredentialConfigurationsSupportedForScopes(
    offeredCredentialConfigurations,
    requestedScopes
  ) as OpenId4VciCredentialConfigurationsSupportedWithFormats

  if (requestedScopes.length === 0 || Object.keys(requestedCredentialConfigurations).length === 0) {
    throw new Oauth2ServerErrorResponseError({
      error: Oauth2ErrorCodes.InvalidScope,
      error_description: `No requested 'scope' values match with offered credential configurations.`,
    })
  }

  const {
    authorizationRequest,
    verificationSession,
    scopes: presentationScopes,
  } = await config.getVerificationSessionForIssuanceSessionAuthorization({
    agentContext,
    issuanceSession,
    requestedCredentialConfigurations,
    scopes: requestedScopes,
  })

  // Store presentation during issuance session on the record
  verificationSession.presentationDuringIssuanceSession = TypedArrayEncoder.toBase64URL(
    agentContext.wallet.getRandomValues(32)
  )
  await agentContext.dependencyManager
    .resolve(OpenId4VcVerificationSessionRepository)
    .update(agentContext, verificationSession)

  const authSession = TypedArrayEncoder.toBase64URL(agentContext.wallet.getRandomValues(32))
  issuanceSession.authorization = {
    ...issuanceSession.authorization,
    scopes: presentationScopes,
  }
  issuanceSession.presentation = {
    required: true,
    authSession,
    openId4VcVerificationSessionId: verificationSession.id,
  }

  // If client attestation is used we have verified this client_id matches with the sub
  // of the wallet attestation
  issuanceSession.clientId = clientAttestation?.clientAttestation.payload.sub ?? authorizationChallengeRequest.client_id

  await openId4VcIssuerService.updateState(
    agentContext,
    issuanceSession,
    OpenId4VcIssuanceSessionState.AuthorizationInitiated
  )

  const authorizationChallengeErrorResponse = authorizationServer.createAuthorizationChallengePresentationErrorResponse(
    {
      authSession,
      presentation: authorizationRequest,
      errorDescription: 'Presentation required before issuance',
    }
  )
  throw new Oauth2ServerErrorResponseError(authorizationChallengeErrorResponse)
}

async function handleAuthorizationChallengeWithAuthSession(options: {
  response: Response
  agentContext: AgentContext
  issuer: OpenId4VcIssuerRecord
  next: NextFunction
  parseResult: ParseAuthorizationChallengeRequestResult
  // FIXME: export in oid4vc-ts
  request: ParseAuthorizationChallengeRequestOptions['request']
}) {
  const { agentContext, issuer, parseResult, request, response, next } = options
  const { authorizationChallengeRequest } = parseResult

  const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
  const config = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)
  const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)

  const verifierApi = agentContext.dependencyManager.resolve(OpenId4VcVerifierApi)

  // NOTE: we ignore scope, issuer_state etc.. parameters if auth_session is present
  // should we validate that these are not in the request? I'm not sure what best practice would be here

  const issuanceSession = await openId4VcIssuerService.findSingleIssuancSessionByQuery(agentContext, {
    issuerId: issuer.issuerId,
    presentationAuthSession: authorizationChallengeRequest.auth_session,
  })
  const allowedStates = [OpenId4VcIssuanceSessionState.AuthorizationInitiated]
  if (
    !issuanceSession?.presentation ||
    !issuanceSession.presentation.openId4VcVerificationSessionId ||
    !issuanceSession.presentation.authSession ||
    !allowedStates.includes(issuanceSession.state)
  ) {
    throw new Oauth2ServerErrorResponseError(
      {
        error: Oauth2ErrorCodes.InvalidSession,
        error_description: `Invalid 'auth_session'`,
      },
      {
        internalMessage: !issuanceSession
          ? `Issuance session not found for 'auth_session' parameter '${authorizationChallengeRequest.auth_session}'`
          : !issuanceSession?.presentation
            ? `Issuance session '${issuanceSession.id}' has no 'presentation'. This should not happen and means state is corrupted`
            : `Issuance session '${issuanceSession.id}' has state '${
                issuanceSession.state
              }' but expected one of ${allowedStates.join(', ')}`,
      }
    )
  }

  const authorizationServer = openId4VcIssuerService.getOauth2AuthorizationServer(agentContext, {
    issuanceSessionId: issuanceSession.id,
  })
  const { clientAttestation, dpop } = await authorizationServer.verifyAuthorizationChallengeRequest({
    authorizationChallengeRequest,
    authorizationServerMetadata: issuerMetadata.authorizationServers[0],
    request,
    clientAttestation: {
      ...parseResult.clientAttestation,
      // We only look at the issuance session here. If it is required
      // it will be defined on the issuance session now.
      required: issuanceSession.walletAttestation?.required,
    },
    dpop: {
      ...parseResult.dpop,
      // We only look at the issuance session here. If it is required
      // it will be defined on the issuance session now.
      required: issuanceSession.dpop?.required,
    },
  })

  if (dpop && dpop.jwkThumbprint !== issuanceSession.dpop?.dpopJkt) {
    throw new Oauth2ServerErrorResponseError(
      {
        error: Oauth2ErrorCodes.InvalidDpopProof,
        error_description: 'Invalid jwk thubmprint',
      },
      {
        internalMessage: `DPoP JWK thumbprint '${dpop.jwkThumbprint}' does not match expected value '${issuanceSession.dpop?.dpopJkt}'`,
      }
    )
  }

  if (clientAttestation && clientAttestation.clientAttestation.payload.sub !== issuanceSession.clientId) {
    throw new Oauth2ServerErrorResponseError(
      {
        error: Oauth2ErrorCodes.InvalidClient,
        error_description: 'Invalid client',
      },
      {
        internalMessage: `Client id '${authorizationChallengeRequest.client_id}' from authorization challenge request does not match client id '${issuanceSession.clientId}' on issuance session`,
      }
    )
  }

  const { openId4VcVerificationSessionId } = issuanceSession.presentation

  await verifierApi
    .getVerificationSessionById(openId4VcVerificationSessionId)
    .catch(async () => {
      // Issuance session is corrupted
      issuanceSession.errorMessage = `Associated openId4VcVeificationSessionRecord with id '${openId4VcVerificationSessionId}' does not exist`
      await openId4VcIssuerService.updateState(agentContext, issuanceSession, OpenId4VcIssuanceSessionState.Error)

      throw new Oauth2ServerErrorResponseError(
        {
          error: Oauth2ErrorCodes.InvalidSession,
          error_description: `Invalid 'auth_session'`,
        },
        {
          internalMessage: `Openid4vc verification session with id '${openId4VcVerificationSessionId}' not found during issuance session with id '${issuanceSession.id}'`,
        }
      )
    })
    .then(async (verificationSession) => {
      // Issuance session cannot be used anymore
      if (verificationSession.state === OpenId4VcVerificationSessionState.Error) {
        issuanceSession.errorMessage = `Associated openId4VcVerificationSessionRecord with id '${openId4VcVerificationSessionId}' has error state`
        await openId4VcIssuerService.updateState(agentContext, issuanceSession, OpenId4VcIssuanceSessionState.Error)
      }

      if (
        verificationSession.state !== OpenId4VcVerificationSessionState.ResponseVerified ||
        authorizationChallengeRequest.presentation_during_issuance_session !==
          verificationSession.presentationDuringIssuanceSession
      ) {
        throw new Oauth2ServerErrorResponseError(
          {
            error: Oauth2ErrorCodes.InvalidSession,
            error_description: `Invalid presentation for 'auth_session'`,
          },
          {
            internalMessage:
              verificationSession.state !== OpenId4VcVerificationSessionState.ResponseVerified
                ? `Openid4vc verification session with id '${openId4VcVerificationSessionId}' has state '${verificationSession.state}', while '${OpenId4VcVerificationSessionState.ResponseVerified}' was expected.`
                : `Openid4vc verification session with id '${openId4VcVerificationSessionId}' has 'presentation_during_issuance_session' '${verificationSession.presentationDuringIssuanceSession}', but authorization challenge request provided value '${authorizationChallengeRequest.presentation_during_issuance_session}'.`,
          }
        )
      }
    })

  // Grant authorization
  const authorizationCode = TypedArrayEncoder.toBase64URL(agentContext.wallet.getRandomValues(32))
  const authorizationCodeExpiresAt = addSecondsToDate(new Date(), config.authorizationCodeExpiresInSeconds)

  issuanceSession.authorization = {
    ...issuanceSession.authorization,
    code: authorizationCode,
    codeExpiresAt: authorizationCodeExpiresAt,
  }

  // TODO: we need to start using locks so we can't get corrupted state
  await openId4VcIssuerService.updateState(
    agentContext,
    issuanceSession,
    OpenId4VcIssuanceSessionState.AuthorizationGranted
  )

  const { authorizationChallengeResponse } = authorizationServer.createAuthorizationChallengeResponse({
    authorizationCode,
  })

  return sendJsonResponse(response, next, authorizationChallengeResponse)
}
