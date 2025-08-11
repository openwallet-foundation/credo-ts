import { Jwt } from '@credo-ts/core'
import { InMemoryWalletModule } from '../../../../../tests/InMemoryWalletModule'
import { type AgentType, createAgentFromModules } from '../../../tests/utils'
import { universityDegreePresentationDefinition } from '../../../tests/utilsVp'
import { OpenId4VcVerifierModule } from '../OpenId4VcVerifierModule'

const modules = {
  openId4VcVerifier: new OpenId4VcVerifierModule({
    baseUrl: 'http://redirect-uri',
  }),
  inMemory: new InMemoryWalletModule(),
}

describe('OpenId4VcVerifier', () => {
  let verifier: AgentType<typeof modules>

  beforeEach(async () => {
    verifier = await createAgentFromModules('verifier', modules, '96213c3d7fc8d4d6754c7a0fd969598f')
  })

  afterEach(async () => {
    await verifier.agent.shutdown()
  })

  describe('Verification', () => {
    it('check openid proof request format (vp token)', async () => {
      const openIdVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()
      const { authorizationRequest, verificationSession } =
        await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
          requestSigner: {
            method: 'did',
            didUrl: verifier.kid,
          },
          verifierId: openIdVerifier.verifierId,
          presentationExchange: {
            definition: universityDegreePresentationDefinition,
          },
          version: 'v1.draft24',
        })

      expect(
        authorizationRequest.startsWith(
          `openid4vp://?client_id=${encodeURIComponent(verifier.did)}&request_uri=http%3A%2F%2Fredirect-uri%2F${
            openIdVerifier.verifierId
          }%2Fauthorization-requests%2F`
        )
      ).toBe(true)

      const jwt = Jwt.fromSerializedJwt(verificationSession.authorizationRequestJwt as string)

      expect(jwt.header.kid)

      expect(jwt.header.kid).toEqual(verifier.kid)
      expect(jwt.header.alg).toEqual('EdDSA')
      expect(jwt.header.typ).toEqual('oauth-authz-req+jwt')
      expect(jwt.payload.additionalClaims.scope).toEqual(undefined)
      expect(jwt.payload.additionalClaims.client_id).toEqual(verifier.did)
      expect(jwt.payload.additionalClaims.response_uri).toEqual(
        `http://redirect-uri/${openIdVerifier.verifierId}/authorize?session=${verificationSession.authorizationRequestId}`
      )
      expect(jwt.payload.additionalClaims.response_mode).toEqual('direct_post.jwt')
      expect(jwt.payload.additionalClaims.nonce).toBeDefined()
      expect(jwt.payload.additionalClaims.state).toBeDefined()
      expect(jwt.payload.additionalClaims.response_type).toEqual('vp_token')
    })
  })
})
