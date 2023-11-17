import type { KeyDidCreateOptions } from '@aries-framework/core'

import { AskarModule } from '@aries-framework/askar'
import {
  JwaSignatureAlgorithm,
  Agent,
  KeyType,
  TypedArrayEncoder,
  W3cCredentialRecord,
  DidKey,
  ClaimFormat,
} from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import nock, { cleanAll, enableNetConnect } from 'nock'

import { OpenIdCredentialFormatProfile } from '../src'
import { OpenId4VcHolderModule } from '../src/OpenId4VcHolderModule'

import {
  mattrLaunchpadJsonLd_draft_08,
  // FIXME: we need a custom document loader for this, which is only present in AFJ core
  // mattrLaunchpadJsonLd_draft_08,
  waltIdJffJwt_draft_08,
  waltIdJffJwt_draft_11,
  waltIssuerPortalV11,
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
        label: 'OpenId4VcHolder Test20',
        walletConfig: {
          id: 'openid4vc-holder-test21',
          key: 'openid4vc-holder-test22',
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
        .get('/.well-known/did.json')
        .reply(200, fixture.wellKnownDid)
        .get('/.well-known/did.json')
        .reply(200, fixture.wellKnownDid)
        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.getMetadataResponse)

        // setup access token response
        .post('/oidc/v1/auth/token')
        .reply(200, fixture.acquireAccessTokenResponse)

        // setup credential request response
        .post('/oidc/v1/auth/credential')
        .reply(200, fixture.jsonLdCredentialResponse)

      const did = await agent.dids.create<KeyDidCreateOptions>({
        method: 'key',
        options: { keyType: KeyType.Ed25519 },
        secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e') },
      })

      const didKey = DidKey.fromDid(did.didState.did as string)
      const kid = `${did.didState.did as string}#${didKey.key.fingerprint}`
      const verificationMethod = did.didState.didDocument?.dereferenceKey(kid, ['authentication'])
      if (!verificationMethod) throw new Error('No verification method found')

      const resolved = await agent.modules.openId4VcHolder.resolveCredentialOffer(
        fixture.permanentResidentCardCredentialOffer
      )

      const w3cCredentialRecords = await agent.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
        resolved,
        {
          verifyCredentialStatus: false,
          // We only allow EdDSa, as we've created a did with keyType ed25519. If we create
          // or determine the did dynamically we could use any signature algorithm
          allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.EdDSA],
          credentialsToRequest: resolved.credentialsToRequest.filter(
            (c) => c.format === OpenIdCredentialFormatProfile.LdpVc
          ),
          proofOfPossessionVerificationMethodResolver: () => verificationMethod,
        }
      )

      expect(w3cCredentialRecords).toHaveLength(1)
      const w3cCredentialRecord = w3cCredentialRecords[0] as W3cCredentialRecord
      expect(w3cCredentialRecord).toBeInstanceOf(W3cCredentialRecord)

      expect(w3cCredentialRecord.credential.type).toEqual(['VerifiableCredential', 'PermanentResidentCard'])

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
          credentialsToRequest: resolvedCredentialOffer.credentialsToRequest.filter((credential) => {
            return credential.format === OpenIdCredentialFormatProfile.JwtVcJson
          }),
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

    it('[DRAFT 08]: should throw if no scope and no authorization_details are provided', async () => {
      const fixture = mattrLaunchpadJsonLd_draft_08

      // setup temporary redirect mock
      nock('https://launchpad.mattrlabs.com')
        .get('/.well-known/openid-credential-issuer')
        .reply(307, undefined, {
          Location: 'https://launchpad.vii.electron.mattrlabs.io/.well-known/openid-credential-issuer',
        })
        .get('/.well-known/openid-configuration')
        .reply(404)
        .get('/.well-known/openid-configuration')
        .reply(404)
        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.getMetadataResponse)
        .get('/.well-known/oauth-authorization-server')
        .reply(404)
        .get('/.well-known/oauth-authorization-server')
        .reply(404)

      // setup server metadata response
      nock('https://launchpad.vii.electron.mattrlabs.io')
        .get('/.well-known/did.json')
        .reply(200, fixture.wellKnownDid)
        .get('/.well-known/did.json')
        .reply(200, fixture.wellKnownDid)
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
        .reply(200, fixture.jsonLdCredentialResponse)

      const did = await agent.dids.create<KeyDidCreateOptions>({
        method: 'key',
        options: { keyType: KeyType.Ed25519 },
        secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e') },
      })

      const didKey = DidKey.fromDid(did.didState.did as string)
      const kid = `${did.didState.did as string}#${didKey.key.fingerprint}`
      const verificationMethod = did.didState.didDocument?.dereferenceKey(kid, ['authentication'])
      if (!verificationMethod) throw new Error('No verification method found')

      const clientId = 'test-client'
      const redirectUri = 'https://example.com/cb'

      const resolvedOffer = await agent.modules.openId4VcHolder.resolveCredentialOffer(
        fixture.credentialOfferAuthorizationCodeFlow
      )

      const resolvedAuthRequest = await agent.modules.openId4VcHolder.resolveAuthorizationRequest(resolvedOffer, {
        clientId,
        redirectUri,
        scope: ['openid'],
      })

      await expect(
        agent.modules.openId4VcHolder.acceptCredentialOfferUsingAuthorizationCode(
          resolvedOffer,
          resolvedAuthRequest,
          'code',
          {
            verifyCredentialStatus: false,
            proofOfPossessionVerificationMethodResolver: () => verificationMethod,
            allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.EdDSA],
          }
        )
      ).rejects.toThrow()
    })

    // Need custom document loader for this
    xit('[DRAFT 08]: should successfully execute request a credential', async () => {
      const fixture = mattrLaunchpadJsonLd_draft_08

      // setup temporary redirect mock
      nock('https://launchpad.mattrlabs.com')
        .get('/.well-known/openid-credential-issuer')
        .reply(307, undefined, {
          Location: 'https://launchpad.vii.electron.mattrlabs.io/.well-known/openid-credential-issuer',
        })
        .get('/.well-known/openid-configuration')
        .reply(404)
        .get('/.well-known/openid-configuration')
        .reply(404)
        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.getMetadataResponse)
        .get('/.well-known/oauth-authorization-server')
        .reply(404)
        .get('/.well-known/oauth-authorization-server')
        .reply(404)

      // setup server metadata response
      nock('https://launchpad.vii.electron.mattrlabs.io')
        .get('/.well-known/did.json')
        .reply(200, fixture.wellKnownDid)
        .get('/.well-known/did.json')
        .reply(200, fixture.wellKnownDid)
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
        .reply(200, fixture.jsonLdCredentialResponse)

      const did = await agent.dids.create<KeyDidCreateOptions>({
        method: 'key',
        options: { keyType: KeyType.Ed25519 },
        secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e') },
      })

      const didKey = DidKey.fromDid(did.didState.did as string)
      const kid = `${did.didState.did as string}#${didKey.key.fingerprint}`
      const verificationMethod = did.didState.didDocument?.dereferenceKey(kid, ['authentication'])
      if (!verificationMethod) throw new Error('No verification method found')

      const opts = {
        clientId: 'test-client',
        redirectUri: 'https://example.com/cb',
        scope: ['TestCredential'],
      }

      const resolvedOffer = await agent.modules.openId4VcHolder.resolveCredentialOffer(
        fixture.credentialOfferAuthorizationCodeFlow
      )

      const resolvedAuthRequest = await agent.modules.openId4VcHolder.resolveAuthorizationRequest(resolvedOffer, opts)

      const w3cCredentialRecords = await agent.modules.openId4VcHolder.acceptCredentialOfferUsingAuthorizationCode(
        resolvedOffer,
        resolvedAuthRequest,
        'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJiMGUxNjc4NS1kNzIyLTQyYTUtYTA0Zi00YmVhYjI4ZTAzZWEiLCJpc3MiOiJodHRwczovL2lzc3Vlci5wb3J0YWwud2FsdC5pZCIsImF1ZCI6IlRPS0VOIn0.ibEpHFaHFBLWyhEf4SotDQZBeh_FMrfncWapNox1Iv1kdQWQ2cLQeS1VrCyVmPsbx0tN2MAyDFG7DnAaq8MiAA',
        {
          verifyCredentialStatus: false,
          proofOfPossessionVerificationMethodResolver: () => verificationMethod,
          allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.EdDSA],
        }
      )

      expect(w3cCredentialRecords).toHaveLength(1)
      const w3cCredentialRecord = w3cCredentialRecords[0] as W3cCredentialRecord
      expect(w3cCredentialRecord).toBeInstanceOf(W3cCredentialRecord)

      expect(w3cCredentialRecord.credential.type).toEqual(['VerifiableCredential', 'PermanentResidentCard'])

      expect(w3cCredentialRecord.credential.credentialSubjectIds[0]).toEqual(did.didState.did)
    })
  })

  describe('[DRAFT 11]: Pre-authorized flow', () => {
    afterEach(() => {
      cleanAll()
      enableNetConnect()
    })

    it('[DRAFT 11]: Should successfully execute the pre-authorized if no credential is requested', async () => {
      const fixture = waltIdJffJwt_draft_11

      /**
       *  Below we're setting up some mock HTTP responses.
       *  These responses are based on the openid-initiate-issuance URI above
       */
      // setup server metadata response
      nock('https://jff.walt.id/issuer-api/default/oidc')
        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.getMetadataResponse)
        .get('/.well-known/openid-configuration')
        .reply(404)
        .get('/.well-known/oauth-authorization-server')
        .reply(404)

      const did = await agent.dids.create<KeyDidCreateOptions>({
        method: 'key',
        options: { keyType: KeyType.P256 },
        secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e') },
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
          credentialsToRequest: [],
        }
      )

      expect(w3cCredentialRecords).toHaveLength(0)
    })

    it('[DRAFT 11]: Should successfully execute the pre-authorized flow using a single offered credential a did:key ES256 subject and JwtVc format', async () => {
      const fixture = waltIdJffJwt_draft_11
      const httpMock = nock('https://jff.walt.id/issuer-api/default/oidc')
        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.getMetadataResponse)
        .get('/.well-known/openid-configuration')
        .reply(404)
        .get('/.well-known/oauth-authorization-server')
        .reply(404)

      // setup access token response
      httpMock.post('/token').reply(200, fixture.acquireAccessTokenResponse)
      // setup credential request response
      httpMock.post('/credential').reply(200, fixture.credentialResponse)

      const did = await agent.dids.create<KeyDidCreateOptions>({
        method: 'key',
        options: { keyType: KeyType.P256 },
        secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e') },
      })

      const didKey = DidKey.fromDid(did.didState.did as string)
      const kid = `${didKey.did}#${didKey.key.fingerprint}`
      const verificationMethod = did.didState.didDocument?.dereferenceKey(kid, ['authentication'])
      if (!verificationMethod) throw new Error('No verification method found')

      const resolved = await agent.modules.openId4VcHolder.resolveCredentialOffer(fixture.credentialOffer)
      expect(resolved.credentialsToRequest).toHaveLength(2)

      const selectedCredentialsForRequest = resolved.credentialsToRequest.filter((credential) => {
        return (
          credential.format === OpenIdCredentialFormatProfile.JwtVcJson && credential.types.includes('VerifiableId')
        )
      })

      expect(selectedCredentialsForRequest).toHaveLength(1)

      const w3cCredentialRecords = await agent.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
        resolved,
        {
          allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.ES256],
          proofOfPossessionVerificationMethodResolver: () => verificationMethod,
          verifyCredentialStatus: false,
          credentialsToRequest: selectedCredentialsForRequest,
        }
      )

      expect(w3cCredentialRecords).toHaveLength(1)
      expect(w3cCredentialRecords[0]).toBeInstanceOf(W3cCredentialRecord)
      const w3cCredentialRecord = w3cCredentialRecords[0] as W3cCredentialRecord

      expect(w3cCredentialRecord.credential.type).toEqual([
        'VerifiableCredential',
        'VerifiableAttestation',
        'VerifiableId',
      ])

      expect(w3cCredentialRecord.credential.credentialSubjectIds[0]).toEqual(did.didState.did)
    })

    xit('[DRAFT 11]: Should successfully execute the pre-authorized flow using a single offered credential a did:key EdDSA subject and JsonLd format', async () => {
      const fixture = waltIdJffJwt_draft_11
      const httpMock = nock('https://jff.walt.id/issuer-api/default/oidc')
        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.getMetadataResponse)
        .get('/.well-known/openid-configuration')
        .reply(404)
        .get('/.well-known/oauth-authorization-server')
        .reply(404)

      // setup access token response
      httpMock.post('/token').reply(200, fixture.acquireAccessTokenResponse)
      // setup credential request response
      httpMock.post('/credential').reply(200, fixture.jsonLdCredentialResponse)

      const did = await agent.dids.create<KeyDidCreateOptions>({
        method: 'key',
        options: { keyType: KeyType.Ed25519 },
        secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e') },
      })

      const didKey = DidKey.fromDid(did.didState.did as string)
      const kid = `${didKey.did}#${didKey.key.fingerprint}`
      const verificationMethod = did.didState.didDocument?.dereferenceKey(kid, ['authentication'])
      if (!verificationMethod) throw new Error('No verification method found')
      const resolvedCredentialOffer = await agent.modules.openId4VcHolder.resolveCredentialOffer(
        fixture.credentialOffer
      )

      expect(resolvedCredentialOffer.credentialsToRequest).toHaveLength(2)
      const selectedCredentialsForRequest = resolvedCredentialOffer.credentialsToRequest.filter((credential) => {
        return (
          credential.format === OpenIdCredentialFormatProfile.LdpVc && credential.types.includes('VerifiableDiploma')
        )
      })

      expect(selectedCredentialsForRequest).toHaveLength(1)

      const w3cCredentialRecords = await agent.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
        resolvedCredentialOffer,
        {
          allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.EdDSA],
          proofOfPossessionVerificationMethodResolver: () => verificationMethod,
          verifyCredentialStatus: false,
          credentialsToRequest: selectedCredentialsForRequest,
        }
      )

      expect(w3cCredentialRecords).toHaveLength(1)
      expect(w3cCredentialRecords[0]).toBeInstanceOf(W3cCredentialRecord)
      const w3cCredentialRecord = w3cCredentialRecords[0] as W3cCredentialRecord

      expect(w3cCredentialRecord.credential.type).toEqual(['VerifiableCredential', 'PermanentResidentCard'])

      expect(w3cCredentialRecord.credential.credentialSubjectIds[0]).toEqual(did.didState.did)
    })

    xit('[DRAFT 11]: Should successfully execute the pre-authorized for multiple credentials of different formats using a did:key EdDsa subject', async () => {
      const fixture = waltIdJffJwt_draft_11
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
      httpMock.post('/credential').reply(200, fixture.jsonLdCredentialResponse)

      const did = await agent.dids.create<KeyDidCreateOptions>({
        method: 'key',
        options: { keyType: KeyType.Ed25519 },
        secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e') },
      })

      const didKey = DidKey.fromDid(did.didState.did as string)
      const kid = `${didKey.did}#${didKey.key.fingerprint}`
      const verificationMethod = did.didState.didDocument?.dereferenceKey(kid, ['authentication'])
      if (!verificationMethod) throw new Error('No verification method found')
      const resolvedCredentialOffer = await agent.modules.openId4VcHolder.resolveCredentialOffer(
        fixture.credentialOffer
      )

      expect(resolvedCredentialOffer.credentialsToRequest).toHaveLength(2)

      const w3cCredentialRecords = await agent.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
        resolvedCredentialOffer,
        {
          allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.EdDSA],
          proofOfPossessionVerificationMethodResolver: () => verificationMethod,
          verifyCredentialStatus: false,
        }
      )

      expect(w3cCredentialRecords.length).toEqual(2)
      expect(w3cCredentialRecords[0]).toBeInstanceOf(W3cCredentialRecord)
      const w3cCredentialRecord = w3cCredentialRecords[0] as W3cCredentialRecord
      expect(w3cCredentialRecord.credential.claimFormat).toEqual(ClaimFormat.JwtVc)
      expect(w3cCredentialRecord.credential.type).toEqual([
        'VerifiableCredential',
        'VerifiableAttestation',
        'VerifiableId',
      ])

      expect(w3cCredentialRecords[1]).toBeInstanceOf(W3cCredentialRecord)
      const w3cCredentialRecord1 = w3cCredentialRecords[1] as W3cCredentialRecord
      expect(w3cCredentialRecord1.credential.claimFormat).toEqual(ClaimFormat.LdpVc)
      expect(w3cCredentialRecord1.credential.type).toEqual(['VerifiableCredential', 'PermanentResidentCard'])
      expect(w3cCredentialRecord1.credential.credentialSubjectIds[0]).toEqual(did.didState.did)
    })

    it('authorization code flow https://portal.walt.id/', async () => {
      const fixture = waltIssuerPortalV11
      // setup temporary redirect mock
      nock('https://issuer.portal.walt.id')
        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.issuerMetadata)
        .get('/.well-known/openid-configuration')
        .reply(404)
        .get('/.well-known/oauth-authorization-server')
        .reply(404)
        .post('/par')
        .reply(200, fixture.par)
        // setup access token response
        .post('/token')
        .reply(200, fixture.acquireAccessTokenResponse)
        // setup credential request response
        .post('/credential')
        .reply(200, fixture.credentialResponse)

        .get('/.well-known/oauth-authorization-server')
        .reply(404)

      const did = await agent.dids.create<KeyDidCreateOptions>({
        method: 'key',
        options: { keyType: KeyType.Ed25519 },
        secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e') },
      })

      const credentialOffer = `openid-credential-offer://?credential_offer=%7B%22credential_issuer%22%3A%22https%3A%2F%2Fissuer.portal.walt.id%22%2C%22credentials%22%3A%5B%7B%22format%22%3A%22jwt_vc_json%22%2C%22types%22%3A%5B%22VerifiableCredential%22%2C%22OpenBadgeCredential%22%5D%2C%22credential_definition%22%3A%7B%22%40context%22%3A%5B%22https%3A%2F%2Fwww.w3.org%2F2018%2Fcredentials%2Fv1%22%2C%22https%3A%2F%2Fpurl.imsglobal.org%2Fspec%2Fob%2Fv3p0%2Fcontext.json%22%5D%2C%22types%22%3A%5B%22VerifiableCredential%22%2C%22OpenBadgeCredential%22%5D%7D%7D%5D%2C%22grants%22%3A%7B%22authorization_code%22%3A%7B%22issuer_state%22%3A%22b0e16785-d722-42a5-a04f-4beab28e03ea%22%7D%2C%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%22eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJiMGUxNjc4NS1kNzIyLTQyYTUtYTA0Zi00YmVhYjI4ZTAzZWEiLCJpc3MiOiJodHRwczovL2lzc3Vlci5wb3J0YWwud2FsdC5pZCIsImF1ZCI6IlRPS0VOIn0.ibEpHFaHFBLWyhEf4SotDQZBeh_FMrfncWapNox1Iv1kdQWQ2cLQeS1VrCyVmPsbx0tN2MAyDFG7DnAaq8MiAA%22%2C%22user_pin_required%22%3Afalse%7D%7D%7D`

      const didKey = DidKey.fromDid(did.didState.did as string)
      const kid = `${didKey.did}#${didKey.key.fingerprint}`
      const verificationMethod = did.didState.didDocument?.dereferenceKey(kid, ['authentication'])
      if (!verificationMethod) throw new Error('No verification method found')

      const resolved = await agent.modules.openId4VcHolder.resolveCredentialOffer(credentialOffer)

      const resolvedAuthorizationRequest = await agent.modules.openId4VcHolder.resolveAuthorizationRequest(resolved, {
        clientId: 'test-client',
        redirectUri: 'http://blank',
        scope: ['openid', 'OpenBadgeCredential'],
      })

      const code =
        'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJiMGUxNjc4NS1kNzIyLTQyYTUtYTA0Zi00YmVhYjI4ZTAzZWEiLCJpc3MiOiJodHRwczovL2lzc3Vlci5wb3J0YWwud2FsdC5pZCIsImF1ZCI6IlRPS0VOIn0.ibEpHFaHFBLWyhEf4SotDQZBeh_FMrfncWapNox1Iv1kdQWQ2cLQeS1VrCyVmPsbx0tN2MAyDFG7DnAaq8MiAA'

      const w3cCredentialRecords = await agent.modules.openId4VcHolder.acceptCredentialOfferUsingAuthorizationCode(
        resolved,
        resolvedAuthorizationRequest,
        code,
        {
          allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.EdDSA],
          proofOfPossessionVerificationMethodResolver: () => verificationMethod,
          verifyCredentialStatus: false,
        }
      )

      expect(w3cCredentialRecords).toHaveLength(1)
    })
  })

  //it('authorization code flow https://portal.walt.id/', async () => {
  //  const did = await agent.dids.create<KeyDidCreateOptions>({
  //    method: 'key',
  //    options: { keyType: KeyType.Ed25519 },
  //    secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e') },
  //  })

  //  const credentialOffer = ``

  //  const didKey = DidKey.fromDid(did.didState.did as string)
  //  const kid = `${didKey.did}#${didKey.key.fingerprint}`
  //  const verificationMethod = did.didState.didDocument?.dereferenceKey(kid, ['authentication'])
  //  if (!verificationMethod) throw new Error('No verification method found')

  //  const resolved = await agent.modules.openId4VcHolder.resolveCredentialOffer(credentialOffer)

  //  const resolvedAuthorizationRequest = await agent.modules.openId4VcHolder.resolveAuthorizationRequest(resolved, {
  //    clientId: 'test-client',
  //    redirectUri: 'http://blank',
  //  })

  //  const code =
  //    'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJiMGUxNjc4NS1kNzIyLTQyYTUtYTA0Zi00YmVhYjI4ZTAzZWEiLCJpc3MiOiJodHRwczovL2lzc3Vlci5wb3J0YWwud2FsdC5pZCIsImF1ZCI6IlRPS0VOIn0.ibEpHFaHFBLWyhEf4SotDQZBeh_FMrfncWapNox1Iv1kdQWQ2cLQeS1VrCyVmPsbx0tN2MAyDFG7DnAaq8MiAA'

  //  const w3cCredentialRecords = await agent.modules.openId4VcHolder.acceptCredentialOfferUsingAuthorizationCode(
  //    resolved,
  //    resolvedAuthorizationRequest,
  //    code,
  //    {
  //      allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.EdDSA],
  //      proofOfPossessionVerificationMethodResolver: () => verificationMethod,
  //      verifyCredentialStatus: false,
  //    }
  //  )

  //  expect(w3cCredentialRecords).toHaveLength(1)
  //})
})
