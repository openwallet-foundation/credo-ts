import type { HolderMetadata, PresentationDefinitionV2 } from '../src'
import type { KeyDidCreateOptions, VerificationMethod } from '@aries-framework/core'

import { AskarModule } from '@aries-framework/askar'
import { Agent, DidKey, Jwt, KeyType, TypedArrayEncoder } from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { SigningAlgo } from '@sphereon/did-auth-siop'
import { cleanAll, enableNetConnect } from 'nock'

import { OpenId4VcVerifierModule, staticOpOpenIdConfig, staticOpSiopConfig } from '../src'

const modules = {
  openId4VcVerifier: new OpenId4VcVerifierModule({}),
  askar: new AskarModule({
    ariesAskar,
  }),
}

export const staticSiopConfigEDDSA: HolderMetadata = {
  ...staticOpSiopConfig,
  idTokenSigningAlgValuesSupported: [SigningAlgo.EDDSA],
  requestObjectSigningAlgValuesSupported: [SigningAlgo.EDDSA],
  vpFormatsSupported: { jwt_vc: { alg: [SigningAlgo.EDDSA] }, jwt_vp: { alg: [SigningAlgo.EDDSA] } },
}

export const staticOpOpenIdConfigEDDSA: HolderMetadata = {
  ...staticOpOpenIdConfig,
  idTokenSigningAlgValuesSupported: [SigningAlgo.EDDSA],
  requestObjectSigningAlgValuesSupported: [SigningAlgo.EDDSA],
  vpFormatsSupported: { jwt_vc: { alg: [SigningAlgo.EDDSA] }, jwt_vp: { alg: [SigningAlgo.EDDSA] } },
}

const universityDegreePresentationDefinition: PresentationDefinitionV2 = {
  id: 'UniversityDegreeCredential',
  input_descriptors: [
    {
      id: 'UniversityDegree',
      // changed jwt_vc_json to jwt_vc
      format: { jwt_vc: { alg: ['EdDSA'] } },
      // changed $.type to $.vc.type
      constraints: {
        fields: [{ path: ['$.vc.type.*'], filter: { type: 'string', pattern: 'UniversityDegree' } }],
      },
    },
  ],
}

describe('OpenId4VcVerifier', () => {
  let agent: Agent<typeof modules>
  let did: string
  let kid: string
  let verificationMethod: VerificationMethod

  beforeEach(async () => {
    agent = new Agent({
      config: {
        label: 'OpenId4VcVerifier Test',
        walletConfig: {
          id: 'openid4vc-Verifier-test',
          key: 'openid4vc-Verifier-test',
        },
      },
      dependencies: agentDependencies,
      modules,
    })

    await agent.initialize()

    const _did = await agent.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { keyType: KeyType.Ed25519 },
      secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598f') },
    })

    did = _did.didState.did as string

    const didKey = DidKey.fromDid(did)
    kid = `${did}#${didKey.key.fingerprint}`
    const _verificationMethod = _did.didState.didDocument?.dereferenceKey(kid, ['authentication'])
    if (!_verificationMethod) throw new Error('No verification method found')
    verificationMethod = _verificationMethod
  })

  afterEach(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  describe('Verification', () => {
    afterEach(() => {
      cleanAll()
      enableNetConnect()
    })

    it(`cannot sign authorization request with alg that isn't supported by the OpenId Provider`, async () => {
      await expect(
        agent.modules.openId4VcVerifier.createProofRequest({
          redirectUri: 'http://redirect-uri',
          verificationMethod,
        })
      ).rejects.toThrow()
    })

    it(`check openid proof request format`, async () => {
      const { proofRequest } = await agent.modules.openId4VcVerifier.createProofRequest({
        redirectUri: 'http://redirect-uri',
        verificationMethod,
        holderMetadata: staticOpOpenIdConfigEDDSA,
        presentationDefinition: universityDegreePresentationDefinition,
      })

      const base =
        'openid://?redirect_uri=http%3A%2F%2Fredirect-uri&presentation_definition=%7B%22id%22%3A%22UniversityDegreeCredential%22%2C%22input_descriptors%22%3A%5B%7B%22id%22%3A%22UniversityDegree%22%2C%22format%22%3A%7B%22jwt_vc%22%3A%7B%22alg%22%3A%5B%22EdDSA%22%5D%7D%7D%2C%22constraints%22%3A%7B%22fields%22%3A%5B%7B%22path%22%3A%5B%22%24.vc.type.*%22%5D%2C%22filter%22%3A%7B%22type%22%3A%22string%22%2C%22pattern%22%3A%22UniversityDegree%22%7D%7D%5D%7D%7D%5D%7D&request='
      expect(proofRequest.startsWith(base)).toBe(true)

      const _jwt = proofRequest.substring(base.length)
      const jwt = Jwt.fromSerializedJwt(_jwt)

      expect(proofRequest.startsWith(base)).toBe(true)

      expect(jwt.header.kid).toEqual(kid)
      expect(jwt.header.alg).toEqual(SigningAlgo.EDDSA)
      expect(jwt.header.typ).toEqual('JWT')
      expect(jwt.payload.additionalClaims.scope).toEqual('openid')
      expect(jwt.payload.additionalClaims.client_id).toEqual(kid)
      expect(jwt.payload.additionalClaims.redirect_uri).toEqual('http://redirect-uri')
      expect(jwt.payload.additionalClaims.response_mode).toEqual('post')
      expect(jwt.payload.additionalClaims.nonce).toBeDefined()
      expect(jwt.payload.additionalClaims.state).toBeDefined()
      expect(jwt.payload.additionalClaims.response_type).toEqual('id_token vp_token')
      expect(jwt.payload.iss).toEqual(did)
      expect(jwt.payload.sub).toEqual(did)
    })

    it(`check siop proof request format`, async () => {
      const { proofRequest } = await agent.modules.openId4VcVerifier.createProofRequest({
        redirectUri: 'http://redirect-uri',
        verificationMethod,
        holderMetadata: staticSiopConfigEDDSA,
      })

      // TODO: this should be siopv2
      const base = 'openid://?redirect_uri=http%3A%2F%2Fredirect-uri&request='
      expect(proofRequest.startsWith(base)).toBe(true)

      const _jwt = proofRequest.substring(base.length)
      const jwt = Jwt.fromSerializedJwt(_jwt)

      expect(jwt.header.kid).toEqual(kid)
      expect(jwt.header.alg).toEqual(SigningAlgo.EDDSA)
      expect(jwt.payload.additionalClaims.scope).toEqual('openid')
      expect(jwt.payload.additionalClaims.client_id).toEqual(kid)
      expect(jwt.payload.additionalClaims.redirect_uri).toEqual('http://redirect-uri')
      expect(jwt.payload.additionalClaims.response_mode).toEqual('post')
      expect(jwt.payload.additionalClaims.response_type).toEqual('id_token')
      expect(jwt.payload.additionalClaims.nonce).toBeDefined()
      expect(jwt.payload.additionalClaims.state).toBeDefined()
      expect(jwt.payload.iss).toEqual(did)
      expect(jwt.payload.sub).toEqual(did)
    })
  })
})
