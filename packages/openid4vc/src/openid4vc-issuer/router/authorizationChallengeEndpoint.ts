import type { OpenId4VcIssuanceRequest } from './requestContext'
import type { OpenId4VciCredentialConfigurationsSupportedWithFormats } from '../../shared'
import type { OpenId4VcIssuerRecord } from '../repository'
import type { AuthorizationChallengeRequest } from '@animo-id/oauth2'
import type { AgentContext } from '@credo-ts/core'
import type { NextFunction, Response, Router } from 'express'

import { Oauth2ErrorCodes, Oauth2ServerErrorResponseError } from '@animo-id/oauth2'
import { TypedArrayEncoder } from '@credo-ts/core'

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
        const authorizationServer = openId4VcIssuerService.getOauth2AuthorizationServer(agentContext)

        const { authorizationChallengeRequest } = authorizationServer.parseAuthorizationChallengeRequest({
          authorizationChallengeRequest: request.body,
        })

        if (authorizationChallengeRequest.auth_session) {
          await handleAuthorizationChallengeWithAuthSession({
            response,
            next,
            authorizationChallengeRequest: {
              // For type inference
              ...authorizationChallengeRequest,
              auth_session: authorizationChallengeRequest.auth_session,
            },
            agentContext,
            issuer,
          })
        } else {
          // First call, no auth_sesion yet
          await handleAuthorizationChallengeNoAuthSession({
            authorizationChallengeRequest,
            agentContext,
            issuer,
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
  authorizationChallengeRequest: AuthorizationChallengeRequest
}) {
  const { agentContext, issuer, authorizationChallengeRequest } = options

  // First call, no auth_sesion yet

  const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
  const config = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)
  const issuerMetadata = await openId4VcIssuerService.getIssuerMetadata(agentContext, issuer)
  const authorizationServer = openId4VcIssuerService.getOauth2AuthorizationServer(agentContext)

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

  if (!authorizationChallengeRequest.scope) {
    throw new Oauth2ServerErrorResponseError({
      error: Oauth2ErrorCodes.InvalidScope,
      error_description: `Missing required 'scope' parameter`,
    })
  }

  if (!authorizationChallengeRequest.issuer_state) {
    throw new Oauth2ServerErrorResponseError({
      error: Oauth2ErrorCodes.InvalidRequest,
      error_description: `Missing required 'issuer_state' parameter. Only requests initiated by a credential offer are supported for authorization challenge.`,
    })
  }

  // FIXME: we need to authenticate the client. Could be either using client_id/client_secret
  // but that doesn't make sense for wallets. So for now we just allow any client_id and we will
  // need OAuth2 Attestation Based Client Auth and dynamically allow client_ids based on wallet providers
  // we trust. Will add this in a follow up PR (basically we do no client authentication at the moment)
  // if (!authorizationChallengeRequest.client_id) {
  //   throw new Oauth2ServerErrorResponseError({
  //     error: Oauth2ErrorCodes.InvalidRequest,
  //     error_description: `Missing required 'client_id' parameter..`,
  //   })
  // }

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

  // NOTE: should only allow authenticated clients in the future.
  issuanceSession.clientId = authorizationChallengeRequest.client_id

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
  authorizationChallengeRequest: AuthorizationChallengeRequest & { auth_session: string }
  next: NextFunction
}) {
  const { agentContext, issuer, authorizationChallengeRequest, response, next } = options

  const openId4VcIssuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
  const config = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)
  const authorizationServer = openId4VcIssuerService.getOauth2AuthorizationServer(agentContext)
  const verifierApi = agentContext.dependencyManager.resolve(OpenId4VcVerifierApi)

  // NOTE: we ignore scope, issuer_state etc.. parameters if auth_session is present
  // should we validate that these are not in the request? I'm not sure what best practive would be here

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
