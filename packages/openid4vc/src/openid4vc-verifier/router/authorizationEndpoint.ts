import type { AgentContext } from '@credo-ts/core'
import type { Response, Router } from 'express'
import type { OpenId4VcVerificationSessionRecord } from '../repository'
import type { OpenId4VcVerificationRequest } from './requestContext'

import { Oauth2ErrorCodes, Oauth2ServerErrorResponseError } from '@animo-id/oauth2'
import { CredoError, JsonEncoder } from '@credo-ts/core'

import { jarmAuthResponseHandle, Openid4vpAuthResponse, parseOpenid4vpRequestParams } from '@openid4vc/oid4vp'
import { getOid4vciCallbacks } from '../../shared/callbacks'
import { getRequestContext, sendErrorResponse, sendJsonResponse, sendOauth2ErrorResponse } from '../../shared/router'
import { OpenId4VcSiopVerifierService } from '../OpenId4VcSiopVerifierService'

export interface OpenId4VcSiopAuthorizationEndpointConfig {
  /**
   * The path at which the authorization endpoint should be made available. Note that it will be
   * hosted at a subpath to take into account multiple tenants and verifiers.
   *
   * @default /authorize
   */
  endpointPath: string
}

async function getVerificationSession(
  agentContext: AgentContext,
  options: {
    verifierId: string
    state?: string
    nonce?: string
  }
): Promise<OpenId4VcVerificationSessionRecord> {
  const { verifierId, state, nonce } = options

  const openId4VcVerifierService = agentContext.dependencyManager.resolve(OpenId4VcSiopVerifierService)
  const session = await openId4VcVerifierService.findVerificationSessionForAuthorizationResponse(agentContext, {
    authorizationResponseParams: { state, nonce },
    verifierId,
  })

  if (!session) {
    agentContext.config.logger.warn(
      `No verification session found for incoming authorization response for verifier ${verifierId}`
    )
    throw new CredoError(`No state or nonce provided in authorization response for verifier ${verifierId}`)
  }

  return session
}


export function configureAuthorizationEndpoint(router: Router, config: OpenId4VcSiopAuthorizationEndpointConfig) {
  router.post(config.endpointPath, async (request: OpenId4VcVerificationRequest, response: Response, next) => {
    const { agentContext, verifier } = getRequestContext(request)

    let jarmResponseType: string | undefined



    try {
      const openId4VcVerifierService = agentContext.dependencyManager.resolve(OpenId4VcSiopVerifierService)

      let verificationSession: OpenId4VcVerificationSessionRecord | undefined
      let authorizationResponsePayload: Openid4vpAuthResponse
      let jarmHeader: { apu?: string; apv?: string } | undefined = undefined

      if (request.body.response) {
        const res2 = await jarmAuthResponseHandle({
          jarm_auth_response_jwt: request.body.response,
          callbacks: getOid4vciCallbacks(agentContext),
          getAuthRequest: async (input) => {
            verificationSession = await getVerificationSession(agentContext, {
              verifierId: verifier.verifierId,
              state: input.state,
              nonce: input.nonce as string,
            })


            const authorizationRequest = await parseOpenid4vpRequestParams(verificationSession.authorizationRequestJwt)
            if (authorizationRequest.type === 'jar') {
                throw new CredoError('Invalid authorization request jwt')
              }
            return { auth_request: authorizationRequest.params}
          }
        })

        jarmResponseType = res2.type

        const [header] = request.body.response.split('.')
        jarmHeader = JsonEncoder.fromBase64(header)
        authorizationResponsePayload = res2.auth_response as Openid4vpAuthResponse
      } else {
        authorizationResponsePayload = request.body
        verificationSession = await getVerificationSession(agentContext, {
          verifierId: verifier.verifierId,
          state: authorizationResponsePayload.state,
          nonce: typeof authorizationResponsePayload.nonce === 'string' ? authorizationResponsePayload.nonce : undefined,
        })
      }

      if (typeof authorizationResponsePayload.presentation_submission === 'string') {
        authorizationResponsePayload.presentation_submission = JSON.parse(
          decodeURIComponent(request.body.presentation_submission)
        )
      }

      if (!verificationSession) {
        throw new CredoError('Missing verification session, cannot verify authorization response.')
      }

      const authorizationRequest = await parseOpenid4vpRequestParams(verificationSession.authorizationRequestJwt)
      if (authorizationRequest.provided !== 'jwt' || authorizationRequest.type !== 'openid4vp') {
        throw new CredoError('Invalid authorization request. Cannot verify authorization response.')
      }

      const responseMode = authorizationRequest.params.response_mode
      if (responseMode?.includes('jwt') && !jarmResponseType) {
        throw new Oauth2ServerErrorResponseError({
          error: Oauth2ErrorCodes.InvalidRequest,
          error_description: `JARM response is required for JWT response mode '${responseMode}'.`,
        })
      }

      if (!responseMode?.includes('jwt') && jarmResponseType) {
        throw new Oauth2ServerErrorResponseError({
          error: Oauth2ErrorCodes.InvalidRequest,
          error_description: `Recieved JARM response which is incompatible with response mode '${responseMode}'.`,
        })
      }

      if (jarmResponseType && jarmResponseType !== 'encrypted') {
        throw new Oauth2ServerErrorResponseError({
          error: Oauth2ErrorCodes.InvalidRequest,
          error_description: `Only encrypted JARM responses are supported, received '${jarmResponseType}'.`,
        })
      }

      await openId4VcVerifierService.verifyAuthorizationResponse(agentContext, {
        authorizationResponse: authorizationResponsePayload,
        verificationSession,
        jarmHeader,
      })

      return sendJsonResponse(response, next, {
        // Used only for presentation during issuance flow, to prevent session fixation.
        presentation_during_issuance_session: verificationSession.presentationDuringIssuanceSession,
      })
    } catch (error) {
      if (error instanceof Oauth2ServerErrorResponseError) {
        return sendOauth2ErrorResponse(response, next, agentContext.config.logger, error)
      }

      return sendErrorResponse(response, next, agentContext.config.logger, 500, 'invalid_request', error)
    }
  })
}
