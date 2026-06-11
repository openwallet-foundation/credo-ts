import { Jwt, utils } from '@credo-ts/core'
import { InMemoryWalletModule } from '../../../../../tests/InMemoryWalletModule'
import { type AgentType, createAgentFromModules } from '../../../tests/utils'
import { openBadgeDcqlQuery, universityDegreePresentationDefinition } from '../../../tests/utilsVp'
import { OpenId4VcModule } from '../../OpenId4VcModule'

const modules = {
  openid4vc: new OpenId4VcModule({
    verifier: {
      baseUrl: 'http://redirect-uri',
    },
  }),
  inMemory: new InMemoryWalletModule(),
}

describe('OpenId4VcVerifier', () => {
  let verifier: AgentType<typeof modules>

  beforeAll(async () => {
    verifier = await createAgentFromModules(modules, '96213c3d7fc8d4d6754c7a0fd969598f')
  })

  afterAll(async () => {
    await verifier.agent.shutdown()
  })

  describe('Verification', () => {
    it('check openid proof request format (vp token)', async () => {
      const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()
      const { authorizationRequest, verificationSession } =
        await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
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

    it('custom expiration is correctly applied', async () => {
      const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()
      const { verificationSession } = await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        requestSigner: {
          method: 'did',
          didUrl: verifier.kid,
        },
        verifierId: openIdVerifier.verifierId,
        dcql: {
          query: openBadgeDcqlQuery,
        },
        expirationInSeconds: 60 * 60,
      })

      expect(verificationSession.expiresAt).toEqual(utils.addSecondsToDate(verificationSession.createdAt, 60 * 60))
    })
  })
})
