import type { OpenId4VcVerificationRequest } from './requestContext'
import type { OpenId4VcVerificationSessionRecord } from '../repository'
import type { AgentContext } from '@credo-ts/core/src/agent/context/AgentContext'
import type { AuthorizationResponsePayload, DecryptCompact } from '@sphereon/did-auth-siop'
import type { Response, Router } from 'express'

import { CredoError, Key, TypedArrayEncoder } from '@credo-ts/core'
import { AuthorizationRequest, RP } from '@sphereon/did-auth-siop'

import { getRequestContext, sendErrorResponse } from '../../shared/router'
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

const decryptJarmResponse = (agentContext: AgentContext): DecryptCompact => {
  return async (input) => {
    const { jwe: compactJwe, jwk: jwkJson } = input
    const key = Key.fromFingerprint(jwkJson.kid)
    if (!agentContext.wallet.directDecryptCompactJweEcdhEs) {
      throw new CredoError('Cannot decrypt Jarm Response, wallet does not support directDecryptCompactJweEcdhEs')
    }

    const { data, header } = await agentContext.wallet.directDecryptCompactJweEcdhEs({ compactJwe, recipientKey: key })
    const decryptedPayload = TypedArrayEncoder.toUtf8String(data)

    return {
      plaintext: decryptedPayload,
      protectedHeader: header as Record<string, unknown> & { alg: string; enc: string },
    }
  }
}

export function configureAuthorizationEndpoint(router: Router, config: OpenId4VcSiopAuthorizationEndpointConfig) {
  router.post(config.endpointPath, async (request: OpenId4VcVerificationRequest, response: Response, next) => {
    const { agentContext, verifier } = getRequestContext(request)

    try {
      const openId4VcVerifierService = agentContext.dependencyManager.resolve(OpenId4VcSiopVerifierService)

      let verificationSession: OpenId4VcVerificationSessionRecord | undefined
      let authorizationResponsePayload: AuthorizationResponsePayload

      if (request.body.response) {
        const res = await RP.processJarmAuthorizationResponse(request.body.response, {
          getAuthRequestPayload: async (input) => {
            verificationSession = await getVerificationSession(agentContext, {
              verifierId: verifier.verifierId,
              state: input.state,
              nonce: input.nonce as string,
            })

            const req = await AuthorizationRequest.fromUriOrJwt(verificationSession.authorizationRequestJwt)
            const requestObjectPayload = await req.requestObject?.getPayload()
            if (!requestObjectPayload) {
              throw new CredoError('No request object payload found.')
            }
            return { authRequestParams: requestObjectPayload }
          },
          decryptCompact: decryptJarmResponse(agentContext),
        })

        // FIXME: verify the apv matches the nonce of the authorization reuqest
        authorizationResponsePayload = res.authResponseParams as AuthorizationResponsePayload
      } else {
        authorizationResponsePayload = request.body
        verificationSession = await getVerificationSession(agentContext, {
          verifierId: verifier.verifierId,
          state: authorizationResponsePayload.state,
          nonce: authorizationResponsePayload.nonce,
        })
      }
      if (typeof authorizationResponsePayload.presentation_submission === 'string') {
        authorizationResponsePayload.presentation_submission = JSON.parse(request.body.presentation_submission)
      }

      // This feels hacky, and should probably be moved to OID4VP lib. However the OID4VP spec allows either object, string, or array...
      if (
        typeof authorizationResponsePayload.vp_token === 'string' &&
        (authorizationResponsePayload.vp_token.startsWith('{') || authorizationResponsePayload.vp_token.startsWith('['))
      ) {
        authorizationResponsePayload.vp_token = JSON.parse(authorizationResponsePayload.vp_token)
      }

      if (!verificationSession) {
        throw new CredoError('Missing verification session, cannot verify authorization response.')
      }

      await openId4VcVerifierService.verifyAuthorizationResponse(agentContext, {
        authorizationResponse: authorizationResponsePayload,
        verificationSession,
      })
      response.status(200).send()
    } catch (error) {
      sendErrorResponse(response, agentContext.config.logger, 500, 'invalid_request', error)
    }

    // NOTE: if we don't call next, the agentContext session handler will NOT be called
    next()
  })
}
