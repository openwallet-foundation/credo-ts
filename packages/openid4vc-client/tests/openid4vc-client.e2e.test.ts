import type { KeyDidCreateOptions } from '@aries-framework/core'

import {
  ClaimFormat,
  JwaSignatureAlgorithm,
  Agent,
  KeyType,
  TypedArrayEncoder,
  W3cCredentialRecord,
  W3cCredentialsModule,
  DidKey,
} from '@aries-framework/core'
import nock, { cleanAll, enableNetConnect } from 'nock'

import { AskarModule } from '../../askar/src'
import { askarModuleConfig } from '../../askar/tests/helpers'
import { customDocumentLoader } from '../../core/src/modules/vc/data-integrity/__tests__/documentLoader'
import { getAgentOptions } from '../../core/tests'

import { mattrLaunchpadJsonLd, waltIdJffJwt } from './fixtures'

import { OpenId4VcClientModule } from '@aries-framework/openid4vc-client'

const modules = {
  openId4VcClient: new OpenId4VcClientModule(),
  w3cCredentials: new W3cCredentialsModule({
    documentLoader: customDocumentLoader,
  }),
  askar: new AskarModule(askarModuleConfig),
}

describe('OpenId4VcClient', () => {
  let agent: Agent<typeof modules>

  beforeEach(async () => {
    const agentOptions = getAgentOptions('OpenId4VcClient Agent', {}, modules)

    agent = new Agent(agentOptions)

    await agent.initialize()
  })

  afterEach(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  describe('Pre-authorized flow', () => {
    afterEach(() => {
      cleanAll()
      enableNetConnect()
    })

    it('Should successfully execute the pre-authorized flow using a did:key Ed25519 subject and JSON-LD credential', async () => {
      /**
       *  Below we're setting up some mock HTTP responses.
       *  These responses are based on the openid-initiate-issuance URI above
       * */

      // setup temporary redirect mock
      nock('https://launchpad.mattrlabs.com').get('/.well-known/openid-credential-issuer').reply(307, undefined, {
        Location: 'https://launchpad.vii.electron.mattrlabs.io/.well-known/openid-credential-issuer',
      })

      // setup server metadata response
      const httpMock = nock('https://launchpad.vii.electron.mattrlabs.io')
        .get('/.well-known/openid-credential-issuer')
        .reply(200, mattrLaunchpadJsonLd.getMetadataResponse)

      // setup access token response
      httpMock.post('/oidc/v1/auth/token').reply(200, mattrLaunchpadJsonLd.acquireAccessTokenResponse)

      // setup credential request response
      httpMock.post('/oidc/v1/auth/credential').reply(200, mattrLaunchpadJsonLd.credentialResponse)

      const did = await agent.dids.create<KeyDidCreateOptions>({
        method: 'key',
        options: {
          keyType: KeyType.Ed25519,
        },
        secret: {
          privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e'),
        },
      })

      const didKey = DidKey.fromDid(did.didState.did as string)
      const kid = `${did.didState.did as string}#${didKey.key.fingerprint}`
      const verificationMethod = did.didState.didDocument?.dereferenceKey(kid, ['authentication'])
      if (!verificationMethod) throw new Error('No verification method found')

      const w3cCredentialRecords = await agent.modules.openId4VcClient.requestCredentialUsingPreAuthorizedCode({
        issuerUri: mattrLaunchpadJsonLd.credentialOffer,
        verifyCredentialStatus: false,
        // We only allow EdDSa, as we've created a did with keyType ed25519. If we create
        // or determine the did dynamically we could use any signature algorithm
        allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.EdDSA],
        proofOfPossessionVerificationMethodResolver: () => verificationMethod,
      })

      expect(w3cCredentialRecords).toHaveLength(1)
      const w3cCredentialRecord = w3cCredentialRecords[0]
      expect(w3cCredentialRecord).toBeInstanceOf(W3cCredentialRecord)

      expect(w3cCredentialRecord.credential.type).toEqual([
        'VerifiableCredential',
        'VerifiableCredentialExtension',
        'OpenBadgeCredential',
      ])

      expect(w3cCredentialRecord.credential.credentialSubjectIds[0]).toEqual(did.didState.did)
    })

    it('Should successfully execute the pre-authorized flow using a did:key P256 subject and JWT credential', async () => {
      /**
       *  Below we're setting up some mock HTTP responses.
       *  These responses are based on the openid-initiate-issuance URI above
       */
      // setup server metadata response
      const httpMock = nock('https://jff.walt.id/issuer-api/default/oidc')
        .get('/.well-known/openid-credential-issuer')
        .reply(200, waltIdJffJwt.getMetadataResponse)
      // setup access token response
      httpMock.post('/token').reply(200, waltIdJffJwt.credentialResponse)
      // setup credential request response
      httpMock.post('/credential').reply(200, waltIdJffJwt.credentialResponse)

      const did = await agent.dids.create<KeyDidCreateOptions>({
        method: 'key',
        options: {
          keyType: KeyType.P256,
        },
        secret: {
          privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e'),
        },
      })

      const didKey = DidKey.fromDid(did.didState.did as string)
      const kid = `${didKey.did}#${didKey.key.fingerprint}`
      const verificationMethod = did.didState.didDocument?.dereferenceKey(kid, ['authentication'])
      if (!verificationMethod) throw new Error('No verification method found')

      const w3cCredentialRecords = await agent.modules.openId4VcClient.requestCredentialUsingPreAuthorizedCode({
        issuerUri: waltIdJffJwt.credentialOffer,
        allowedCredentialFormats: [ClaimFormat.JwtVc],
        allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.ES256],
        proofOfPossessionVerificationMethodResolver: () => verificationMethod,
        verifyCredentialStatus: false,
      })

      expect(w3cCredentialRecords[0]).toBeInstanceOf(W3cCredentialRecord)
      const w3cCredentialRecord = w3cCredentialRecords[0]

      expect(w3cCredentialRecord.credential.type).toEqual([
        'VerifiableCredential',
        'VerifiableAttestation',
        'VerifiableId',
      ])

      expect(w3cCredentialRecord.credential.credentialSubjectIds[0]).toEqual(did.didState.did)
    })
  })

  describe('Authorization flow', () => {
    beforeAll(async () => {
      /**
       *  Below we're setting up some mock HTTP responses.
       *  These responses are based on the openid-initiate-issuance URI above
       * */

      // setup temporary redirect mock
      nock('https://launchpad.mattrlabs.com').get('/.well-known/openid-credential-issuer').reply(307, undefined, {
        Location: 'https://launchpad.vii.electron.mattrlabs.io/.well-known/openid-credential-issuer',
      })

      // setup server metadata response
      const httpMock = nock('https://launchpad.vii.electron.mattrlabs.io')
        .get('/.well-known/openid-credential-issuer')
        .reply(200, mattrLaunchpadJsonLd.getMetadataResponse)

      // setup access token response
      httpMock.post('/oidc/v1/auth/token').reply(200, mattrLaunchpadJsonLd.acquireAccessTokenResponse)

      // setup credential request response
      httpMock.post('/oidc/v1/auth/credential').reply(200, mattrLaunchpadJsonLd.credentialResponse)
    })

    afterAll(async () => {
      cleanAll()
      enableNetConnect()
    })

    it('should generate a valid authorization url', async () => {
      const clientId = 'test-client'

      const redirectUri = 'https://example.com/cb'
      const scope = ['TestCredential']
      const initiationUri =
        'openid-initiate-issuance://?issuer=https://launchpad.mattrlabs.com&credential_type=OpenBadgeCredential'
      const { authorizationUrl } = await agent.modules.openId4VcClient.generateAuthorizationUrl({
        clientId,
        redirectUri,
        scope,
        initiationUri,
      })

      const parsedUrl = new URL(authorizationUrl)
      expect(authorizationUrl.startsWith('https://launchpad.vii.electron.mattrlabs.io/oidc/v1/auth/authorize')).toBe(
        true
      )
      expect(parsedUrl.searchParams.get('response_type')).toBe('code')
      expect(parsedUrl.searchParams.get('client_id')).toBe(clientId)
      expect(parsedUrl.searchParams.get('code_challenge_method')).toBe('S256')
      expect(parsedUrl.searchParams.get('redirect_uri')).toBe(redirectUri)
    })
    it('should throw if no scope is provided', async () => {
      // setup temporary redirect mock
      nock('https://launchpad.mattrlabs.com').get('/.well-known/openid-credential-issuer').reply(307, undefined, {
        Location: 'https://launchpad.vii.electron.mattrlabs.io/.well-known/openid-credential-issuer',
      })

      // setup server metadata response
      nock('https://launchpad.vii.electron.mattrlabs.io')
        .get('/.well-known/openid-credential-issuer')
        .reply(200, mattrLaunchpadJsonLd.getMetadataResponse)

      const clientId = 'test-client'
      const redirectUri = 'https://example.com/cb'
      const initiationUri =
        'openid-initiate-issuance://?issuer=https://launchpad.mattrlabs.com&credential_type=OpenBadgeCredential'
      expect(
        agent.modules.openId4VcClient.generateAuthorizationUrl({
          clientId,
          redirectUri,
          scope: [],
          initiationUri,
        })
      ).rejects.toThrow()
    })
    it('should successfully execute request a credential', async () => {
      // setup temporary redirect mock
      nock('https://launchpad.mattrlabs.com').get('/.well-known/openid-credential-issuer').reply(307, undefined, {
        Location: 'https://launchpad.vii.electron.mattrlabs.io/.well-known/openid-credential-issuer',
      })

      // setup server metadata response
      nock('https://launchpad.vii.electron.mattrlabs.io')
        .get('/.well-known/openid-credential-issuer')
        .reply(200, mattrLaunchpadJsonLd.getMetadataResponse)

      const did = await agent.dids.create<KeyDidCreateOptions>({
        method: 'key',
        options: {
          keyType: KeyType.Ed25519,
        },
        secret: {
          privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e'),
        },
      })

      const didKey = DidKey.fromDid(did.didState.did as string)
      const kid = `${did.didState.did as string}#${didKey.key.fingerprint}`
      const verificationMethod = did.didState.didDocument?.dereferenceKey(kid, ['authentication'])
      if (!verificationMethod) throw new Error('No verification method found')

      const clientId = 'test-client'

      const redirectUri = 'https://example.com/cb'
      const initiationUri =
        'openid-initiate-issuance://?issuer=https://launchpad.mattrlabs.com&credential_type=OpenBadgeCredential'

      const scope = ['TestCredential']
      const { codeVerifier } = await agent.modules.openId4VcClient.generateAuthorizationUrl({
        clientId,
        redirectUri,
        scope,
        initiationUri,
      })
      const w3cCredentialRecords = await agent.modules.openId4VcClient.requestCredentialUsingAuthorizationCode({
        clientId: clientId,
        authorizationCode: 'test-code',
        codeVerifier: codeVerifier,
        verifyCredentialStatus: false,
        proofOfPossessionVerificationMethodResolver: () => verificationMethod,
        allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.EdDSA],
        issuerUri: initiationUri,
        redirectUri: redirectUri,
      })

      expect(w3cCredentialRecords).toHaveLength(1)
      const w3cCredentialRecord = w3cCredentialRecords[0]
      expect(w3cCredentialRecord).toBeInstanceOf(W3cCredentialRecord)

      expect(w3cCredentialRecord.credential.type).toEqual([
        'VerifiableCredential',
        'VerifiableCredentialExtension',
        'OpenBadgeCredential',
      ])

      expect(w3cCredentialRecord.credential.credentialSubjectIds[0]).toEqual(did.didState.did)
    })
  })
})
