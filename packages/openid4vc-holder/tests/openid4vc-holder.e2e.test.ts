import type { KeyDidCreateOptions } from '@aries-framework/core'

import { AskarModule } from '@aries-framework/askar'
import {
  JwaSignatureAlgorithm,
  Agent,
  KeyType,
  TypedArrayEncoder,
  W3cCredentialRecord,
  DidKey,
} from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import nock, { cleanAll, enableNetConnect } from 'nock'

import { OpenId4VcHolderModule } from '../src'
import { OpenIdCredentialFormatProfile } from '../src/utils/claimFormatMapping'

import {
  mattrLaunchpadJsonLd_draft_08,
  // FIXME: we need a custom document loader for this, which is only present in AFJ core
  // mattrLaunchpadJsonLd_draft_08,
  waltIdJffJwt_draft_08,
  waltIdJffJwt_draft_11,
} from './fixtures'

const modules = {
  openId4VcHolder: new OpenId4VcHolderModule(),
  askar: new AskarModule({
    ariesAskar,
  }),
}

describe('OpenId4VcHolder', () => {
  let agent: Agent<typeof modules>

  beforeEach(async () => {
    agent = new Agent({
      config: {
        label: 'OpenId4VcHolder Test',
        walletConfig: {
          id: 'openid4vc-holder-test',
          key: 'openid4vc-holder-test',
        },
      },
      dependencies: agentDependencies,
      modules,
    })

    await agent.initialize()
  })

  afterEach(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  describe('[DRAFT 08]: Pre-authorized flow', () => {
    afterEach(() => {
      cleanAll()
      enableNetConnect()
    })

    xit('[DRAFT 08]: Should successfully execute the pre-authorized flow using a did:key Ed25519 subject and JSON-LD credential', async () => {
      const fixture = mattrLaunchpadJsonLd_draft_08
      /**
       *  Below we're setting up some mock HTTP responses.
       *  These responses are based on the openid-initiate-issuance URI above
       * */

      // setup temporary redirect mock
      nock('https://launchpad.mattrlabs.com')
        .get('/.well-known/openid-credential-issuer')
        .reply(307, undefined, {
          Location: 'https://launchpad.vii.electron.mattrlabs.io/.well-known/openid-credential-issuer',
        })

        .get('/.well-known/openid-configuration')
        .reply(404)

        .get('/.well-known/oauth-authorization-server')
        .reply(404)

      // setup server metadata response
      nock('https://launchpad.vii.electron.mattrlabs.io')
        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.getMetadataResponse)

        // setup access token response
        .post('/oidc/v1/auth/token')
        .reply(200, fixture.acquireAccessTokenResponse)

        // setup credential request response
        .post('/oidc/v1/auth/credential')
        .reply(200, fixture.credentialResponse)

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

      const resolvedCredentialOffer = await agent.modules.openId4VcHolder.resolveCredentialOffer(
        fixture.credentialOffer
      )

      const w3cCredentialRecords = await agent.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
        resolvedCredentialOffer,
        {
          verifyCredentialStatus: false,
          // We only allow EdDSa, as we've created a did with keyType ed25519. If we create
          // or determine the did dynamically we could use any signature algorithm
          allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.EdDSA],
          proofOfPossessionVerificationMethodResolver: () => verificationMethod,
        }
      )

      expect(w3cCredentialRecords).toHaveLength(1)
      const w3cCredentialRecord = w3cCredentialRecords[0] as W3cCredentialRecord
      expect(w3cCredentialRecord).toBeInstanceOf(W3cCredentialRecord)

      expect(w3cCredentialRecord.credential.type).toEqual([
        'VerifiableCredential',
        'VerifiableCredentialExtension',
        'OpenBadgeCredential',
      ])

      expect(w3cCredentialRecord.credential.credentialSubjectIds[0]).toEqual(did.didState.did)
    })

    it('[DRAFT 08]: Should successfully execute the pre-authorized flow using a did:key P256 subject and JWT credential', async () => {
      const fixture = waltIdJffJwt_draft_08

      nock('https://jff.walt.id/issuer-api/default/oidc')
        // metadata
        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.getMetadataResponse)
        .get('/.well-known/openid-configuration')
        .reply(404)
        .get('/.well-known/oauth-authorization-server')
        .reply(404)

        // setup access token response
        .post('/token')
        .reply(200, fixture.credentialResponse)

        // setup credential request response
        .post('/credential')
        .reply(200, fixture.credentialResponse)

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

      const resolvedCredentialOffer = await agent.modules.openId4VcHolder.resolveCredentialOffer(
        fixture.credentialOffer
      )

      const w3cCredentialRecords = await agent.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
        resolvedCredentialOffer,
        {
          allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.ES256],
          proofOfPossessionVerificationMethodResolver: () => verificationMethod,
          verifyCredentialStatus: false,
        }
      )

      expect(w3cCredentialRecords[0]).toBeInstanceOf(W3cCredentialRecord)
      const w3cCredentialRecord = w3cCredentialRecords[0] as W3cCredentialRecord

      expect(w3cCredentialRecord.credential.type).toEqual([
        'VerifiableCredential',
        'VerifiableAttestation',
        'VerifiableId',
      ])

      expect(w3cCredentialRecord.credential.credentialSubjectIds[0]).toEqual(did.didState.did)
    })
  })

  describe('[DRAFT 08]: Authorization flow', () => {
    afterAll(() => {
      cleanAll()
      enableNetConnect()
    })

    it('[DRAFT 08]: should generate a valid authorization url', async () => {
      const fixture = mattrLaunchpadJsonLd_draft_08

      // setup temporary redirect mock
      nock('https://launchpad.mattrlabs.com')
        .get('/.well-known/openid-credential-issuer')
        .reply(307, undefined, {
          Location: 'https://launchpad.vii.electron.mattrlabs.io/.well-known/openid-credential-issuer',
        })
        .get('/.well-known/openid-configuration')
        .reply(404)
        .get('/.well-known/oauth-authorization-server')
        .reply(404)

      // setup server metadata response
      nock('https://launchpad.vii.electron.mattrlabs.io')
        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.getMetadataResponse)

        // setup access token response
        .post('/oidc/v1/auth/token')
        .reply(200, fixture.acquireAccessTokenResponse)

        // setup credential request response
        .post('/oidc/v1/auth/credential')
        .reply(200, fixture.credentialResponse)

      const clientId = 'test-client'

      const redirectUri = 'https://example.com/cb'
      const scope = ['TestCredential']
      const initiationUri =
        'openid-initiate-issuance://?issuer=https://launchpad.mattrlabs.com&credential_type=OpenBadgeCredential'
      const { authorizationUrl } = await agent.modules.openId4VcHolder.generateAuthorizationUrl({
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

    it('[DRAFT 08]: should throw if no scope is provided', async () => {
      const fixture = mattrLaunchpadJsonLd_draft_08

      // setup temporary redirect mock
      nock('https://launchpad.mattrlabs.com').get('/.well-known/openid-credential-issuer').reply(307, undefined, {
        Location: 'https://launchpad.vii.electron.mattrlabs.io/.well-known/openid-credential-issuer',
      })

      // setup server metadata response
      nock('https://launchpad.vii.electron.mattrlabs.io')
        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.getMetadataResponse)
        .get('/.well-known/openid-configuration')
        .reply(404)
        .get('/.well-known/oauth-authorization-server')
        .reply(404)

        // setup access token response
        .post('/oidc/v1/auth/token')
        .reply(200, fixture.acquireAccessTokenResponse)

        // setup credential request response
        .post('/oidc/v1/auth/credential')
        .reply(200, fixture.credentialResponse)

      // setup server metadata response
      nock('https://launchpad.vii.electron.mattrlabs.io')
        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.getMetadataResponse)

      const clientId = 'test-client'
      const redirectUri = 'https://example.com/cb'
      const initiationUri =
        'openid-initiate-issuance://?issuer=https://launchpad.mattrlabs.com&credential_type=OpenBadgeCredential'
      await expect(
        agent.modules.openId4VcHolder.generateAuthorizationUrl({
          clientId,
          redirectUri,
          scope: [],
          initiationUri,
        })
      ).rejects.toThrow()
    })

    // Need custom document loader for this
    xit('[DRAFT 08]: should successfully execute request a credential', async () => {
      const fixture = mattrLaunchpadJsonLd_draft_08

      // setup temporary redirect mock
      nock('https://launchpad.mattrlabs.com').get('/.well-known/openid-credential-issuer').reply(307, undefined, {
        Location: 'https://launchpad.vii.electron.mattrlabs.io/.well-known/openid-credential-issuer',
      })

      // setup server metadata response
      nock('https://launchpad.vii.electron.mattrlabs.io')
        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.getMetadataResponse)
        .get('/.well-known/openid-configuration')
        .reply(404)
        .get('/.well-known/oauth-authorization-server')
        .reply(404)

        // setup access token response
        .post('/oidc/v1/auth/token')
        .reply(200, fixture.acquireAccessTokenResponse)

        // setup credential request response
        .post('/oidc/v1/auth/credential')
        .reply(200, fixture.credentialResponse)

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
      const { codeVerifier } = await agent.modules.openId4VcHolder.generateAuthorizationUrl({
        clientId,
        redirectUri,
        scope,
        initiationUri,
      })

      const resolvedCredentialOffer = await agent.modules.openId4VcHolder.resolveCredentialOffer(
        fixture.credentialOffer
      )

      const w3cCredentialRecords = await agent.modules.openId4VcHolder.acceptCredentialOfferUsingAuthorizationCode(
        resolvedCredentialOffer,
        {
          clientId: clientId,
          authorizationCode: 'test-code',
          codeVerifier: codeVerifier,
          verifyCredentialStatus: false,
          proofOfPossessionVerificationMethodResolver: () => verificationMethod,
          allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.EdDSA],
          redirectUri: redirectUri,
        }
      )

      expect(w3cCredentialRecords).toHaveLength(1)
      const w3cCredentialRecord = w3cCredentialRecords[0] as W3cCredentialRecord
      expect(w3cCredentialRecord).toBeInstanceOf(W3cCredentialRecord)

      expect(w3cCredentialRecord.credential.type).toEqual([
        'VerifiableCredential',
        'VerifiableCredentialExtension',
        'OpenBadgeCredential',
      ])

      expect(w3cCredentialRecord.credential.credentialSubjectIds[0]).toEqual(did.didState.did)
    })
  })

  describe('[DRAFT 11]: Pre-authorized flow', () => {
    afterEach(() => {
      cleanAll()
      enableNetConnect()
    })

    // it('[DRAFT 11]: Should successfully execute the pre-authorized flow using a did:key Ed25519 subject and JSON-LD credential', async () => {
    //   const fixture = waltIdJffJwt_draft_11

    //   nock('https://jff.walt.id/issuer-api/default/oidc')
    //     .get('/.well-known/openid-credential-issuer')
    //     .reply(200, fixture.getMetadataResponse)

    //     // setup access token response
    //     .post('/token')
    //     .reply(200, fixture.credentialResponse)

    //     // setup credential request response
    //     .post('/credential')
    //     .reply(200, fixture.credentialResponse)

    //   const did = await agent.dids.create<KeyDidCreateOptions>({
    //     method: 'key',
    //     options: {
    //       keyType: KeyType.Ed25519,
    //     },
    //     secret: {
    //       privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e'),
    //     },
    //   })

    //   const didKey = DidKey.fromDid(did.didState.did as string)
    //   const kid = `${did.didState.did as string}#${didKey.key.fingerprint}`
    //   const verificationMethod = did.didState.didDocument?.dereferenceKey(kid, ['authentication'])
    //   if (!verificationMethod) throw new Error('No verification method found')

    //   const w3cCredentialRecords = await agent.modules.openId4VcClient.requestCredentialUsingPreAuthorizedCode({
    //     uri: fixture.credentialOffer,
    //     verifyCredentialStatus: false,
    //     // We only allow EdDSa, as we've created a did with keyType ed25519. If we create
    //     // or determine the did dynamically we could use any signature algorithm
    //     allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.EdDSA],
    //     proofOfPossessionVerificationMethodResolver: () => verificationMethod,
    //   })

    //   expect(w3cCredentialRecords).toHaveLength(1)
    //   const w3cCredentialRecord = w3cCredentialRecords[0]
    //   expect(w3cCredentialRecord).toBeInstanceOf(W3cCredentialRecord)

    //   expect(w3cCredentialRecord.credential.type).toEqual([
    //     'VerifiableCredential',
    //     'VerifiableAttestation',
    //     'VerifiableId',
    //   ])

    //   expect(w3cCredentialRecord.credential.credentialSubjectIds[0]).toEqual(did.didState.did)
    // })

    it('[DRAFT 11]: Should successfully execute the pre-authorized flow using a did:key P256 subject and JWT credential', async () => {
      const fixture = waltIdJffJwt_draft_11

      /**
       *  Below we're setting up some mock HTTP responses.
       *  These responses are based on the openid-initiate-issuance URI above
       */
      // setup server metadata response
      const httpMock = nock('https://jff.walt.id/issuer-api/default/oidc')
        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.getMetadataResponse)
        .get('/.well-known/openid-configuration')
        .reply(404)
        .get('/.well-known/oauth-authorization-server')
        .reply(404)

      // setup access token response
      httpMock.post('/token').reply(200, fixture.credentialResponse)
      // setup credential request response
      httpMock.post('/credential').reply(200, fixture.credentialResponse)

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
      const resolvedCredentialOffer = await agent.modules.openId4VcHolder.resolveCredentialOffer(
        fixture.credentialOffer
      )

      const w3cCredentialRecords = await agent.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
        resolvedCredentialOffer,
        {
          allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.ES256],
          proofOfPossessionVerificationMethodResolver: () => verificationMethod,
          verifyCredentialStatus: false,
        }
      )

      expect(w3cCredentialRecords[0]).toBeInstanceOf(W3cCredentialRecord)
      const w3cCredentialRecord = w3cCredentialRecords[0] as W3cCredentialRecord

      expect(w3cCredentialRecord.credential.type).toEqual([
        'VerifiableCredential',
        'VerifiableAttestation',
        'VerifiableId',
      ])

      expect(w3cCredentialRecord.credential.credentialSubjectIds[0]).toEqual(did.didState.did)
    })

      expect(w3cCredentialRecords[0]).toBeInstanceOf(W3cCredentialRecord)
      const w3cCredentialRecord = w3cCredentialRecords[0] as W3cCredentialRecord

      expect(w3cCredentialRecord.credential.type).toEqual([
        'VerifiableCredential',
        'VerifiableAttestation',
        'VerifiableId',
      ])

      expect(w3cCredentialRecord.credential.credentialSubjectIds[0]).toEqual(did.didState.did)
    })
  })
})
