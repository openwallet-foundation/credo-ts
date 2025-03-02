import type { Server } from 'http'
import type { Express } from 'express'
import type { AgentType } from '../../../tests/utils'
import type { OpenId4VcVerifierRecord } from '../../openid4vc-verifier/repository'

import express from 'express'

import { AskarModule } from '../../../../askar/src'
import { askarModuleConfig } from '../../../../askar/tests/helpers'
import { createAgentFromModules, waitForVerificationSessionRecordSubject } from '../../../tests/utils'
import { OpenId4VcVerificationSessionState, OpenId4VcVerifierModule } from '../../openid4vc-verifier'
import { OpenId4VcHolderModule } from '../OpenId4VcHolderModule'

const port = 3121
const verificationEndpointPath = '/proofResponse'
const verifierBaseUrl = `http://localhost:${port}`

const holderModules = {
  openId4VcHolder: new OpenId4VcHolderModule(),
  askar: new AskarModule(askarModuleConfig),
}

const verifierModules = {
  openId4VcVerifier: new OpenId4VcVerifierModule({
    baseUrl: verifierBaseUrl,
    endpoints: {
      authorization: {
        endpointPath: verificationEndpointPath,
      },
    },
  }),
  askar: new AskarModule(askarModuleConfig),
}

describe('OpenId4VcHolder | OpenID4VP', () => {
  let openIdVerifier: OpenId4VcVerifierRecord
  let verifier: AgentType<typeof verifierModules>
  let holder: AgentType<typeof holderModules>
  let verifierApp: Express

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let verifierServer: Server<any, any>

  beforeEach(async () => {
    verifier = await createAgentFromModules('verifier', verifierModules, '96213c3d7fc8d4d6754c7a0fd969598f')
    openIdVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()
    holder = await createAgentFromModules('holder', holderModules, '96213c3d7fc8d4d6754c7a0fd969598e')
    verifierApp = express()

    verifierApp.use('/', verifier.agent.modules.openId4VcVerifier.config.router)
    verifierServer = verifierApp.listen(port)
  })

  afterEach(async () => {
    verifierServer?.close()
    await holder.agent.shutdown()
    await holder.agent.wallet.delete()
    await verifier.agent.shutdown()
    await verifier.agent.wallet.delete()
  })

  it('siop authorization request without presentation exchange', async () => {
    const { authorizationRequest, verificationSession } =
      await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
        requestSigner: {
          method: 'did',
          didUrl: verifier.kid,
        },
        verifierId: openIdVerifier.verifierId,
      })

    const resolvedAuthorizationRequest =
      await holder.agent.modules.openId4VcHolder.resolveSiopAuthorizationRequest(authorizationRequest)

    const { submittedResponse, serverResponse } =
      await holder.agent.modules.openId4VcHolder.acceptSiopAuthorizationRequest({
        authorizationRequest: resolvedAuthorizationRequest.authorizationRequest,
        // When no VP is created, we need to provide the did we want to use for authentication
        openIdTokenIssuer: {
          method: 'did',
          didUrl: holder.kid,
        },
      })

    expect(serverResponse).toEqual({
      status: 200,
      body: {},
    })

    expect(submittedResponse).toMatchObject({
      id_token: expect.any(String),
      state: expect.any(String),
    })

    await waitForVerificationSessionRecordSubject(verifier.replaySubject, {
      state: OpenId4VcVerificationSessionState.ResponseVerified,
      contextCorrelationId: verifier.agent.context.contextCorrelationId,
      verificationSessionId: verificationSession.id,
    })

    const { idToken, presentationExchange } =
      await verifier.agent.modules.openId4VcVerifier.getVerifiedAuthorizationResponse(verificationSession.id)

    expect(presentationExchange).toBeUndefined()
    expect(idToken).toMatchObject({
      payload: {
        state: expect.any(String),
        nonce: expect.any(String),
      },
    })
  })
})
