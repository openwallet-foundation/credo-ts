import type { NextFunction, Request, Response, Router } from 'express'
import type { OpenId4VcVerificationRequest } from './requestContext'

import { Oauth2ErrorCodes, Oauth2ServerErrorResponseError, decodeJwtHeader } from '@openid4vc/oauth2'

import { AgentContext, TypedArrayEncoder } from '@credo-ts/core'
// FIXME: export parseOpenid4VpAuthorizationResponsePayload from openid4vp
import { zOpenid4vpAuthorizationResponse } from '@openid4vc/openid4vp'
import {
  getRequestContext,
  sendErrorResponse,
  sendJsonResponse,
  sendOauth2ErrorResponse,
  sendUnknownServerErrorResponse,
} from '../../shared/router'
import { OpenId4VpVerifierService } from '../OpenId4VpVerifierService'
import {
  OpenId4VcVerificationSessionRecord,
  OpenId4VcVerificationSessionRepository,
  OpenId4VcVerifierRecord,
} from '../repository'

import { ValidationError } from '@openid4vc/utils'
import { OpenId4VcVerifierModuleConfig } from '../OpenId4VcVerifierModuleConfig'

export function configureAuthorizationEndpoint(router: Router, config: OpenId4VcVerifierModuleConfig) {
  router.post(config.authorizationEndpoint, async (request: OpenId4VcVerificationRequest, response: Response, next) => {
    const { agentContext, verifier } = getRequestContext(request)
    const openId4VcVerifierService = agentContext.dependencyManager.resolve(OpenId4VpVerifierService)

    let authorizationResponseRedirectUri: string | undefined = undefined

    try {
      const result = await getVerificationSession(agentContext, request, response, next, verifier)

      // Response already handled in the method
      if (!result.success) return

      authorizationResponseRedirectUri = result.verificationSession.authorizationResponseRedirectUri

      const { verificationSession } = await openId4VcVerifierService.verifyAuthorizationResponse(agentContext, {
        authorizationResponse: request.body,
        verificationSession: result.verificationSession,
      })

      return sendJsonResponse(response, next, {
        // Used only for presentation during issuance flow, to prevent session fixation.
        presentation_during_issuance_session: verificationSession.presentationDuringIssuanceSession,

        redirect_uri: verificationSession.authorizationResponseRedirectUri,
      })
    } catch (error) {
      if (error instanceof Oauth2ServerErrorResponseError) {
        error.errorResponse.redirect_uri = authorizationResponseRedirectUri
        return sendOauth2ErrorResponse(response, next, agentContext.config.logger, error)
      }

      // FIXME: should throw a Oauth2ServerErrorResponseError in the oid4vp library
      if (error instanceof ValidationError) {
        return sendOauth2ErrorResponse(
          response,
          next,
          agentContext.config.logger,
          new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidRequest,
              error_description: error.message,
              redirect_uri: authorizationResponseRedirectUri,
            },
            { cause: error }
          )
        )
      }

      return sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error, {
        redirect_uri: authorizationResponseRedirectUri,
      })
    }
  })
}

async function getVerificationSession(
  agentContext: AgentContext,
  request: Request,
  response: Response,
  next: NextFunction,
  verifier: OpenId4VcVerifierRecord
): Promise<{ success: true; verificationSession: OpenId4VcVerificationSessionRecord } | { success: false }> {
  const openId4VcVerificationSessionRepository = agentContext.dependencyManager.resolve(
    OpenId4VcVerificationSessionRepository
  )

  try {
    if (request.query.session) {
      if (typeof request.query.session !== 'string') {
        sendErrorResponse(
          response,
          next,
          agentContext.config.logger,
          400,
          Oauth2ErrorCodes.InvalidRequest,
          `Unexpected value for 'session' query param`
        )
        return { success: false }
      }

      const verificationSession = await openId4VcVerificationSessionRepository.findSingleByQuery(agentContext, {
        verifierId: verifier.verifierId,
        authorizationRequestId: request.query.session,
      })

      if (!verificationSession) {
        sendErrorResponse(
          response,
          next,
          agentContext.config.logger,
          400,
          Oauth2ErrorCodes.InvalidRequest,
          `Invalid 'session' parameter`
        )
        return { success: false }
      }

      return { success: true, verificationSession }
    }

    const parsedResponse = zOpenid4vpAuthorizationResponse.safeParse(request.body)
    if (parsedResponse.success) {
      if (!parsedResponse.data.state) {
        sendErrorResponse(
          response,
          next,
          agentContext.config.logger,
          400,
          Oauth2ErrorCodes.InvalidRequest,
          `Missing required 'state' parameter in response without response encryption`
        )
        return { success: false }
      }

      const verificationSession = await openId4VcVerificationSessionRepository.findSingleByQuery(agentContext, {
        payloadState: parsedResponse.data.state,
        verifierId: verifier.verifierId,
      })

      if (!verificationSession) {
        sendErrorResponse(
          response,
          next,
          agentContext.config.logger,
          400,
          Oauth2ErrorCodes.InvalidRequest,
          `Invalid 'state' parameter`
        )
        return { success: false }
      }

      return { success: true, verificationSession }
    }

    // Try extracting apv (request nonce), which is used in encrypted responses (for ISO 18013-7/before draft 24)
    if (typeof request.body === 'object' && 'response' in request.body) {
      const { header } = decodeJwtHeader({
        jwt: request.body.response,
      })

      if (!header.apv) {
        sendErrorResponse(
          response,
          next,
          agentContext.config.logger,
          400,
          Oauth2ErrorCodes.InvalidRequest,
          `Missing 'session' query param or 'apv' value in header of encrypted JARM response.`
        )
        return { success: false }
      }

      if (typeof header.apv !== 'string') {
        sendErrorResponse(
          response,
          next,
          agentContext.config.logger,
          400,
          Oauth2ErrorCodes.InvalidRequest,
          `'apv' value in header of encrypted JARM response is not of type string.`
        )
        return { success: false }
      }

      const nonce = TypedArrayEncoder.toUtf8String(TypedArrayEncoder.fromBase64(header.apv))
      const verificationSession = await openId4VcVerificationSessionRepository.findSingleByQuery(agentContext, {
        nonce,
        verifierId: verifier.verifierId,
      })

      if (!verificationSession) {
        sendErrorResponse(
          response,
          next,
          agentContext.config.logger,
          400,
          Oauth2ErrorCodes.InvalidRequest,
          `Invalid 'apv' parameter`
        )
        return { success: false }
      }

      return { success: true, verificationSession }
    }

    sendErrorResponse(
      response,
      next,
      agentContext.config.logger,
      400,
      Oauth2ErrorCodes.InvalidRequest,
      'Invalid response'
    )
    return { success: false }
  } catch (error) {
    sendUnknownServerErrorResponse(response, next, agentContext.config.logger, error)
    return { success: false }
  }
}
