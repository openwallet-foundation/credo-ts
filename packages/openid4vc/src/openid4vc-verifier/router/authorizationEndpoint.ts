import type { OpenId4VcVerificationRequest } from './requestContext'
import type { OpenId4VcVerificationSessionRecord } from '../repository'
import type { JwkJson } from '@credo-ts/core'
import type { AgentContext } from '@credo-ts/core/src/agent/context/AgentContext'
import type { AuthorizationResponsePayload } from '@sphereon/did-auth-siop'
import type { Response, Router } from 'express'

import { CredoError } from '@credo-ts/core'
import { AuthorizationRequest, RP } from '@sphereon/did-auth-siop'
import * as jose from 'jose'

import { getRequestContext, sendErrorResponse } from '../../shared/router'
import { OpenId4VcSiopVerifierService } from '../OpenId4VcSiopVerifierService'

export const ISO_MDL_7_EPHEMERAL_READER_PRIVATE_KEY_JWK = {
  kty: 'EC',
  d: '_Hc7lRd1Zt8sDAb1-pCgI9qS3oobKNa-mjRDhaKjH90',
  use: 'enc',
  crv: 'P-256',
  x: 'xVLtZaPPK-xvruh1fEClNVTR6RCZBsQai2-DrnyKkxg',
  y: '-5-QtFqJqGwOjEL3Ut89nrE0MeaUp5RozksKHpBiyw0',
  alg: 'ECDH-ES',
  kid: 'P8p0virRlh6fAkh5-YSeHt4EIv-hFGneYk14d8DF51w',
}

const decryptCompact = async (input: { jwk: { kid: string }; jwe: string }) => {
  const { jwe, jwk } = input

  let jwkToUse: JwkJson
  if (jwk.kid === ISO_MDL_7_EPHEMERAL_READER_PRIVATE_KEY_JWK.kid) {
    jwkToUse = ISO_MDL_7_EPHEMERAL_READER_PRIVATE_KEY_JWK
  } else {
    throw new CredoError('Invalid JWK provided for decryption')
  }

  const privateKey = await jose.importJWK(jwkToUse)
  const decode = TextDecoder.prototype.decode.bind(new TextDecoder())

  const { plaintext, protectedHeader } = await jose.compactDecrypt(jwe, privateKey)

  return {
    plaintext: decode(plaintext),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protectedHeader: protectedHeader as any,
  }
}

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
    nonce?: unknown
  }
): Promise<OpenId4VcVerificationSessionRecord> {
  const { verifierId, state, nonce } = options

  const openId4VcVerifierService = agentContext.dependencyManager.resolve(OpenId4VcSiopVerifierService)
  const session = await openId4VcVerifierService.findVerificationSessionForAuthorizationResponse(agentContext, {
    authorizationResponseParams: { state, nonce: nonce as string },
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

    try {
      const openId4VcVerifierService = agentContext.dependencyManager.resolve(OpenId4VcSiopVerifierService)

      let verificationSession: OpenId4VcVerificationSessionRecord
      let authorizationResponsePayload: AuthorizationResponsePayload

      if (request.body.response) {
        const res = await RP.processJarmAuthorizationResponse(request.body.response, {
          getAuthRequestPayload: async (input) => {
            verificationSession = await getVerificationSession(agentContext, {
              verifierId: verifier.verifierId,
              state: input.state,
              nonce: input.nonce,
            })

            const res = await AuthorizationRequest.fromUriOrJwt(verificationSession.authorizationRequestJwt)
            const requestObjectPayload = await res.requestObject?.getPayload()
            if (!requestObjectPayload) {
              throw new CredoError('No request object payload found.')
            }
            return { authRequestParams: requestObjectPayload }
          },
          decryptCompact,
        })

        authorizationResponsePayload = res.authResponseParams as AuthorizationResponsePayload
      } else {
        authorizationResponsePayload = request.body
      }

      verificationSession = await getVerificationSession(agentContext, {
        verifierId: verifier.verifierId,
        state: authorizationResponsePayload.state,
        nonce: authorizationResponsePayload.nonce,
      })

      if (typeof authorizationResponsePayload.presentation_submission === 'string') {
        authorizationResponsePayload.presentation_submission = JSON.parse(
          authorizationResponsePayload.presentation_submission
        )
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
