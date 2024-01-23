import { AskarModule } from '@aries-framework/askar'
import { Jwt } from '@aries-framework/core'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { SigningAlgo } from '@sphereon/did-auth-siop'
import { cleanAll, enableNetConnect } from 'nock'

import { OpenId4VcVerifierModule } from '..'
import { createAgentFromModules, type AgentType } from '../../../tests/utils'
import {
  staticOpOpenIdConfigEdDSA,
  staticSiopConfigEDDSA,
  universityDegreePresentationDefinition,
} from '../../../tests/utilsVp'

const modules = {
  openId4VcVerifier: new OpenId4VcVerifierModule({
    verifierMetadata: {
      verifierBaseUrl: 'http://redirect-uri',
      verificationEndpointPath: '',
    },
  }),
  askar: new AskarModule({
    ariesAskar,
  }),
}

describe('OpenId4VcVerifier', () => {
  let verifier: AgentType<typeof modules>

  beforeEach(async () => {
    verifier = await createAgentFromModules('verifier', { ...modules }, '96213c3d7fc8d4d6754c7a0fd969598f')
  })

  afterEach(async () => {
    await verifier.agent.shutdown()
    await verifier.agent.wallet.delete()
  })

  describe('Verification', () => {
    afterEach(() => {
      cleanAll()
      enableNetConnect()
    })

    it(`cannot sign authorization request with alg that isn't supported by the OpenId Provider`, async () => {
      await expect(
        verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
          verificationEndpointUrl: 'http://redirect-uri',
          verificationMethod: verifier.verificationMethod,
        })
      ).rejects.toThrow()
    })

    it(`check openid proof request format`, async () => {
      const { authorizationRequestUri } = await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
        verificationEndpointUrl: 'http://redirect-uri',
        verificationMethod: verifier.verificationMethod,
        openIdProvider: staticOpOpenIdConfigEdDSA,
        presentationDefinition: universityDegreePresentationDefinition,
      })

      const base =
        'openid://?redirect_uri=http%3A%2F%2Fredirect-uri&presentation_definition=%7B%22id%22%3A%22UniversityDegreeCredential%22%2C%22input_descriptors%22%3A%5B%7B%22id%22%3A%22UniversityDegree%22%2C%22format%22%3A%7B%22jwt_vc%22%3A%7B%22alg%22%3A%5B%22EdDSA%22%5D%7D%7D%2C%22constraints%22%3A%7B%22fields%22%3A%5B%7B%22path%22%3A%5B%22%24.vc.type.*%22%5D%2C%22filter%22%3A%7B%22type%22%3A%22string%22%2C%22pattern%22%3A%22UniversityDegree%22%7D%7D%5D%7D%7D%5D%7D&request='
      expect(authorizationRequestUri.startsWith(base)).toBe(true)

      const _jwt = authorizationRequestUri.substring(base.length)
      const jwt = Jwt.fromSerializedJwt(_jwt)

      expect(authorizationRequestUri.startsWith(base)).toBe(true)

      expect(jwt.header.kid).toEqual(verifier.kid)
      expect(jwt.header.alg).toEqual(SigningAlgo.EDDSA)
      expect(jwt.header.typ).toEqual('JWT')
      expect(jwt.payload.additionalClaims.scope).toEqual('openid')
      expect(jwt.payload.additionalClaims.client_id).toEqual(verifier.kid)
      expect(jwt.payload.additionalClaims.redirect_uri).toEqual('http://redirect-uri')
      expect(jwt.payload.additionalClaims.response_mode).toEqual('post')
      expect(jwt.payload.additionalClaims.nonce).toBeDefined()
      expect(jwt.payload.additionalClaims.state).toBeDefined()
      expect(jwt.payload.additionalClaims.response_type).toEqual('id_token vp_token')
      expect(jwt.payload.iss).toEqual(verifier.did)
      expect(jwt.payload.sub).toEqual(verifier.did)
    })

    it(`check siop proof request format`, async () => {
      const { authorizationRequestUri } = await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
        verificationEndpointUrl: 'http://redirect-uri',
        verificationMethod: verifier.verificationMethod,
        openIdProvider: staticSiopConfigEDDSA,
      })

      // TODO: this should be siopv2
      const base = 'openid://?redirect_uri=http%3A%2F%2Fredirect-uri&request='
      expect(authorizationRequestUri.startsWith(base)).toBe(true)

      const _jwt = authorizationRequestUri.substring(base.length)
      const jwt = Jwt.fromSerializedJwt(_jwt)

      expect(jwt.header.kid).toEqual(verifier.kid)
      expect(jwt.header.alg).toEqual(SigningAlgo.EDDSA)
      expect(jwt.payload.additionalClaims.scope).toEqual('openid')
      expect(jwt.payload.additionalClaims.client_id).toEqual(verifier.kid)
      expect(jwt.payload.additionalClaims.redirect_uri).toEqual('http://redirect-uri')
      expect(jwt.payload.additionalClaims.response_mode).toEqual('post')
      expect(jwt.payload.additionalClaims.response_type).toEqual('id_token')
      expect(jwt.payload.additionalClaims.nonce).toBeDefined()
      expect(jwt.payload.additionalClaims.state).toBeDefined()
      expect(jwt.payload.iss).toEqual(verifier.did)
      expect(jwt.payload.sub).toEqual(verifier.did)
    })
  })
})
