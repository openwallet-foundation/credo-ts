import type { CredentialSupported, IssuerMetadata, PreAuthorizedCodeFlowConfig } from '../../openid4vc-issuer'
import type { KeyDidCreateOptions, VerificationMethod } from '@aries-framework/core'
import type { Server } from 'http'

import { AskarModule } from '@aries-framework/askar'
import {
  Agent,
  ClaimFormat,
  DidKey,
  JwaSignatureAlgorithm,
  KeyType,
  TypedArrayEncoder,
  W3cCredential,
  W3cCredentialRecord,
  W3cCredentialSubject,
  W3cIssuer,
  w3cDate,
} from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'
import { SdJwtVcModule } from '@aries-framework/sd-jwt-vc'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import express, { Router, type Express } from 'express'
import nock, { cleanAll, enableNetConnect } from 'nock'

import { OpenIdCredentialFormatProfile } from '..'
import { OpenId4VcIssuerModule } from '../../openid4vc-issuer'
import { OpenId4VcHolderModule } from '../OpenId4VcHolderModule'

import {
  mattrLaunchpadJsonLd_draft_08,
  waltIdJffJwt_draft_08,
  waltIdJffJwt_draft_11,
  waltIssuerPortalV11,
} from './fixtures'

const issuerPort = 1234
const credentialIssuer = `http://localhost:${issuerPort}`

const openBadgeCredential: CredentialSupported & { id: string } = {
  id: `${credentialIssuer}/credentials/OpenBadgeCredential`,
  format: OpenIdCredentialFormatProfile.JwtVcJson,
  types: ['VerifiableCredential', 'OpenBadgeCredential'],
}

const universityDegreeCredential: CredentialSupported & { id: string } = {
  id: `${credentialIssuer}/credentials/UniversityDegreeCredential`,
  format: OpenIdCredentialFormatProfile.JwtVcJson,
  types: ['VerifiableCredential', 'UniversityDegreeCredential'],
}

const universityDegreeCredentialLd: CredentialSupported & { id: string } = {
  id: `${credentialIssuer}/credentials/UniversityDegreeCredentialLd`,
  format: OpenIdCredentialFormatProfile.JwtVcJsonLd,
  types: ['VerifiableCredential', 'UniversityDegreeCredential'],
  '@context': ['context'],
}

const universityDegreeCredentialSdJwt = {
  id: 'https://openid4vc-issuer.com/credentials/UniversityDegreeCredentialSdJwt',
  format: OpenIdCredentialFormatProfile.SdJwtVc,
  credential_definition: {
    vct: 'UniversityDegreeCredential',
  },
} satisfies CredentialSupported & { id: string }

const baseCredentialRequestOptions = {
  scheme: 'openid-credential-offer',
  baseUri: credentialIssuer,
}

const issuerMetadata: IssuerMetadata = {
  credentialIssuer,
  credentialEndpoint: `${credentialIssuer}/credentials`,
  tokenEndpoint: `${credentialIssuer}/token`,
  credentialsSupported: [openBadgeCredential, universityDegreeCredentialLd, universityDegreeCredentialSdJwt],
}

const holderModules = {
  openId4VcHolder: new OpenId4VcHolderModule(),
  sdJwtVc: new SdJwtVcModule(),
  askar: new AskarModule({ ariesAskar }),
}

const issuerModules = {
  openId4VcIssuer: new OpenId4VcIssuerModule({ issuerMetadata }),
  sdJwtVc: new SdJwtVcModule(),
  askar: new AskarModule({ ariesAskar }),
}

describe('OpenId4VcHolder', () => {
  let issuerApp: Express
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let issuerServer: Server<any, any>

  let issuer: Agent<typeof issuerModules>
  let issuerKid: string
  let issuerDid: string
  let issuerVerificationMethod: VerificationMethod

  let holder: Agent<typeof holderModules>
  let holderKid: string
  let holderDid: string
  let holderVerificationMethod: VerificationMethod

  let holderP256Kid: string
  let holderP256Did: string
  let holderP256VerificationMethod: VerificationMethod

  beforeEach(async () => {
    issuerApp = express()

    issuer = new Agent({
      config: {
        label: 'OpenId4VcIssuer Test28',
        walletConfig: { id: 'openid4vc-issuer-test27', key: 'openid4vc-issuer-test27' },
      },
      dependencies: agentDependencies,
      modules: issuerModules,
    })

    holder = new Agent({
      config: {
        label: 'OpenId4VcHolder Test28',
        walletConfig: { id: 'openid4vc-holder-test27', key: 'openid4vc-holder-test27' },
      },
      dependencies: agentDependencies,
      modules: holderModules,
    })

    await issuer.initialize()
    await holder.initialize()

    const holderDidCreateResult = await holder.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { keyType: KeyType.Ed25519 },
      secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e') },
    })

    holderDid = holderDidCreateResult.didState.did as string
    const holderDidKey = DidKey.fromDid(holderDid)
    holderKid = `${holderDid}#${holderDidKey.key.fingerprint}`

    const _holderVerificationMethod = holderDidCreateResult.didState.didDocument?.dereferenceKey(holderKid, [
      'authentication',
    ])
    if (!_holderVerificationMethod) throw new Error('No verification method found')
    holderVerificationMethod = _holderVerificationMethod

    const holderP256DidCreateResult = await holder.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { keyType: KeyType.P256 },
      secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e') },
    })

    holderP256Did = holderP256DidCreateResult.didState.did as string
    const holderP256DidKey = DidKey.fromDid(holderP256Did)
    holderP256Kid = `${holderP256Did}#${holderP256DidKey.key.fingerprint}`

    const _holderP256VerificationMethod = holderP256DidCreateResult.didState.didDocument?.dereferenceKey(
      holderP256Kid,
      ['authentication']
    )
    if (!_holderP256VerificationMethod) throw new Error('No verification method found')
    holderP256VerificationMethod = _holderP256VerificationMethod

    const issuerDidCreateResult = await issuer.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { keyType: KeyType.Ed25519 },
      secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598f') },
    })

    issuerDid = issuerDidCreateResult.didState.did as string

    const issuerDidKey = DidKey.fromDid(issuerDid)
    issuerKid = `${issuerDid}#${issuerDidKey.key.fingerprint}`
    const _issuerVerificationMethod = issuerDidCreateResult.didState.didDocument?.dereferenceKey(issuerKid, [
      'authentication',
    ])
    if (!_issuerVerificationMethod) throw new Error('No verification method found')
    issuerVerificationMethod = _issuerVerificationMethod
  })

  afterEach(async () => {
    issuerServer?.close()

    await issuer.shutdown()
    await issuer.wallet.delete()

    await holder.shutdown()
    await holder.wallet.delete()
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

      const resolved = await holder.modules.openId4VcHolder.resolveCredentialOffer(
        fixture.permanentResidentCardCredentialOffer
      )

      const w3cCredentialRecords = await holder.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
        resolved,
        {
          verifyCredentialStatus: false,
          // We only allow EdDSa, as we've created a did with keyType ed25519. If we create
          // or determine the did dynamically we could use any signature algorithm
          allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.EdDSA],
          credentialsToRequest: resolved.offeredCredentials.filter((c) => c.format === 'ldp_vc'),
          proofOfPossessionVerificationMethodResolver: () => holderVerificationMethod,
        }
      )

      expect(w3cCredentialRecords).toHaveLength(1)
      const w3cCredentialRecord = w3cCredentialRecords[0] as W3cCredentialRecord
      expect(w3cCredentialRecord).toBeInstanceOf(W3cCredentialRecord)

      expect(w3cCredentialRecord.credential.type).toEqual(['VerifiableCredential', 'PermanentResidentCard'])

      expect(w3cCredentialRecord.credential.credentialSubjectIds[0]).toEqual(holderDid)
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

      const resolvedCredentialOffer = await holder.modules.openId4VcHolder.resolveCredentialOffer(
        fixture.credentialOffer
      )

      const w3cCredentialRecords = await holder.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
        resolvedCredentialOffer,
        {
          allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.ES256],
          proofOfPossessionVerificationMethodResolver: () => holderP256VerificationMethod,
          verifyCredentialStatus: false,
          credentialsToRequest: resolvedCredentialOffer.offeredCredentials.filter((credential) => {
            return credential.format === 'jwt_vc_json'
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

      expect(w3cCredentialRecord.credential.credentialSubjectIds[0]).toEqual(holderP256Did)
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

      const clientId = 'test-client'
      const redirectUri = 'https://example.com/cb'

      const resolvedOffer = await holder.modules.openId4VcHolder.resolveCredentialOffer(
        fixture.credentialOfferAuthorizationCodeFlow
      )

      const resolvedAuthRequest = await holder.modules.openId4VcHolder.resolveAuthorizationRequest(resolvedOffer, {
        clientId,
        redirectUri,
        scope: ['openid'],
      })

      await expect(
        holder.modules.openId4VcHolder.acceptCredentialOfferUsingAuthorizationCode(
          resolvedOffer,
          resolvedAuthRequest,
          'code',
          {
            verifyCredentialStatus: false,
            proofOfPossessionVerificationMethodResolver: () => holderVerificationMethod,
            allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.EdDSA],
          }
        )
      ).rejects.toThrow()
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

        const resolvedCredentialOffer = await holder.modules.openId4VcHolder.resolveCredentialOffer(
          fixture.credentialOffer
        )

        const w3cCredentialRecords = await holder.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
          resolvedCredentialOffer,
          {
            allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.ES256],
            proofOfPossessionVerificationMethodResolver: () => holderVerificationMethod,
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

        const resolved = await holder.modules.openId4VcHolder.resolveCredentialOffer(fixture.credentialOffer)
        expect(resolved.offeredCredentials).toHaveLength(2)

        const selectedCredentialsForRequest = resolved.offeredCredentials.filter((credential) => {
          return credential.format === 'jwt_vc_json' && credential.types.includes('VerifiableId')
        })

        expect(selectedCredentialsForRequest).toHaveLength(1)

        const w3cCredentialRecords = await holder.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
          resolved,
          {
            allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.ES256],
            proofOfPossessionVerificationMethodResolver: () => holderP256VerificationMethod,
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

        expect(w3cCredentialRecord.credential.credentialSubjectIds[0]).toEqual(holderP256Did)
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

        const resolvedCredentialOffer = await holder.modules.openId4VcHolder.resolveCredentialOffer(
          fixture.credentialOffer
        )

        expect(resolvedCredentialOffer.offeredCredentials).toHaveLength(2)
        const selectedCredentialsForRequest = resolvedCredentialOffer.offeredCredentials.filter((credential) => {
          return (
            credential.format === OpenIdCredentialFormatProfile.LdpVc && credential.types.includes('VerifiableDiploma')
          )
        })

        expect(selectedCredentialsForRequest).toHaveLength(1)

        const w3cCredentialRecords = await holder.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
          resolvedCredentialOffer,
          {
            allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.EdDSA],
            proofOfPossessionVerificationMethodResolver: () => holderVerificationMethod,
            verifyCredentialStatus: false,
            credentialsToRequest: selectedCredentialsForRequest,
          }
        )

        expect(w3cCredentialRecords).toHaveLength(1)
        expect(w3cCredentialRecords[0]).toBeInstanceOf(W3cCredentialRecord)
        const w3cCredentialRecord = w3cCredentialRecords[0] as W3cCredentialRecord

        expect(w3cCredentialRecord.credential.type).toEqual(['VerifiableCredential', 'PermanentResidentCard'])

        expect(w3cCredentialRecord.credential.credentialSubjectIds[0]).toEqual(holderDid)
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

        const resolvedCredentialOffer = await holder.modules.openId4VcHolder.resolveCredentialOffer(
          fixture.credentialOffer
        )

        expect(resolvedCredentialOffer.offeredCredentials).toHaveLength(2)

        const w3cCredentialRecords = await holder.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
          resolvedCredentialOffer,
          {
            allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.EdDSA],
            proofOfPossessionVerificationMethodResolver: () => holderVerificationMethod,
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
        expect(w3cCredentialRecord1.credential.credentialSubjectIds[0]).toEqual(holderDid)
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

        const credentialOffer = `openid-credential-offer://?credential_offer=%7B%22credential_issuer%22%3A%22https%3A%2F%2Fissuer.portal.walt.id%22%2C%22credentials%22%3A%5B%7B%22format%22%3A%22jwt_vc_json%22%2C%22types%22%3A%5B%22VerifiableCredential%22%2C%22OpenBadgeCredential%22%5D%2C%22credential_definition%22%3A%7B%22%40context%22%3A%5B%22https%3A%2F%2Fwww.w3.org%2F2018%2Fcredentials%2Fv1%22%2C%22https%3A%2F%2Fpurl.imsglobal.org%2Fspec%2Fob%2Fv3p0%2Fcontext.json%22%5D%2C%22types%22%3A%5B%22VerifiableCredential%22%2C%22OpenBadgeCredential%22%5D%7D%7D%5D%2C%22grants%22%3A%7B%22authorization_code%22%3A%7B%22issuer_state%22%3A%22b0e16785-d722-42a5-a04f-4beab28e03ea%22%7D%2C%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%22eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJiMGUxNjc4NS1kNzIyLTQyYTUtYTA0Zi00YmVhYjI4ZTAzZWEiLCJpc3MiOiJodHRwczovL2lzc3Vlci5wb3J0YWwud2FsdC5pZCIsImF1ZCI6IlRPS0VOIn0.ibEpHFaHFBLWyhEf4SotDQZBeh_FMrfncWapNox1Iv1kdQWQ2cLQeS1VrCyVmPsbx0tN2MAyDFG7DnAaq8MiAA%22%2C%22user_pin_required%22%3Afalse%7D%7D%7D`
        const resolved = await holder.modules.openId4VcHolder.resolveCredentialOffer(credentialOffer)

        const resolvedAuthorizationRequest = await holder.modules.openId4VcHolder.resolveAuthorizationRequest(
          resolved,
          {
            clientId: 'test-client',
            redirectUri: 'http://blank',
            scope: ['openid', 'OpenBadgeCredential'],
          }
        )

        const code =
          'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJiMGUxNjc4NS1kNzIyLTQyYTUtYTA0Zi00YmVhYjI4ZTAzZWEiLCJpc3MiOiJodHRwczovL2lzc3Vlci5wb3J0YWwud2FsdC5pZCIsImF1ZCI6IlRPS0VOIn0.ibEpHFaHFBLWyhEf4SotDQZBeh_FMrfncWapNox1Iv1kdQWQ2cLQeS1VrCyVmPsbx0tN2MAyDFG7DnAaq8MiAA'

        const w3cCredentialRecords = await holder.modules.openId4VcHolder.acceptCredentialOfferUsingAuthorizationCode(
          resolved,
          resolvedAuthorizationRequest,
          code,
          {
            allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.EdDSA],
            proofOfPossessionVerificationMethodResolver: () => holderVerificationMethod,
            verifyCredentialStatus: false,
          }
        )

        expect(w3cCredentialRecords).toHaveLength(1)
      })

      it('e2e flow with issuer endpoints requesting multiple credentials', async () => {
        const router = Router()
        await issuer.modules.openId4VcIssuer.configureRouter(router, {
          metadataEndpointConfig: { enabled: true },
          accessTokenEndpointConfig: {
            enabled: true,
            preAuthorizedCodeExpirationDuration: 50,
            verificationMethod: issuerVerificationMethod,
          },
          credentialEndpointConfig: {
            enabled: true,
            verificationMethod: issuerVerificationMethod,
            credentialRequestToCredentialMapper: async (credentialRequest, metadata) => {
              if (
                credentialRequest.format === 'jwt_vc_json' &&
                credentialRequest.types.includes('OpenBadgeCredential')
              ) {
                if (metadata.holderDid !== holderDid) throw new Error('Invalid holder did')

                return new W3cCredential({
                  type: openBadgeCredential.types,
                  issuer: new W3cIssuer({ id: issuerDid }),
                  credentialSubject: new W3cCredentialSubject({ id: metadata.holderDid }),
                  issuanceDate: w3cDate(Date.now()),
                })
              }

              if (
                credentialRequest.format === 'jwt_vc_json' &&
                credentialRequest.types.includes('UniversityDegreeCredential')
              ) {
                return new W3cCredential({
                  type: universityDegreeCredential.types,
                  issuer: new W3cIssuer({ id: issuerDid }),
                  credentialSubject: new W3cCredentialSubject({ id: holderDid }),
                  issuanceDate: w3cDate(Date.now()),
                })
              }
              throw new Error('Invalid request')
            },
          },
        })

        issuerApp.use('/', router)
        issuerServer = issuerApp.listen(issuerPort)

        const preAuthorizedCodeFlowConfig: PreAuthorizedCodeFlowConfig = {
          preAuthorizedCode: '123456789',
          userPinRequired: false,
        }

        const { credentialOfferRequest } = await issuer.modules.openId4VcIssuer.createCredentialOfferAndRequest(
          [
            openBadgeCredential.id,
            {
              format: universityDegreeCredential.format,
              types: universityDegreeCredential.types,
            },
          ],
          {
            preAuthorizedCodeFlowConfig,
            ...baseCredentialRequestOptions,
            baseUri: '',
          }
        )

        const resolvedCredentialOffer = await holder.modules.openId4VcHolder.resolveCredentialOffer(
          credentialOfferRequest
        )

        const credentials = await holder.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
          resolvedCredentialOffer,
          {
            proofOfPossessionVerificationMethodResolver: async () => {
              return holderVerificationMethod
            },
          }
        )

        expect(credentials).toHaveLength(2)
        expect(credentials[0]).toBeInstanceOf(W3cCredentialRecord)
        if (credentials[0].type === 'SdJwtVcRecord') throw new Error('Invalid credential type')
        if (credentials[1].type === 'SdJwtVcRecord') throw new Error('Invalid credential type')

        expect(credentials[0].credential.type).toHaveLength(2)
        expect(credentials[1].credential.type).toHaveLength(2)

        if (credentials[0].credential.type.includes('OpenBadgeCredential')) {
          expect(credentials[0].credential.type).toEqual(['VerifiableCredential', 'OpenBadgeCredential'])
          expect(credentials[1].credential.type).toEqual(['VerifiableCredential', 'UniversityDegreeCredential'])
        } else {
          expect(credentials[1].credential.type).toEqual(['VerifiableCredential', 'OpenBadgeCredential'])
          expect(credentials[0].credential.type).toEqual(['VerifiableCredential', 'UniversityDegreeCredential'])
        }
      })
    })

    it('e2e flow with issuer endpoints requesting sdjwtvc', async () => {
      const router = Router()
      await issuer.modules.openId4VcIssuer.configureRouter(router, {
        metadataEndpointConfig: { enabled: true },
        accessTokenEndpointConfig: {
          enabled: true,
          preAuthorizedCodeExpirationDuration: 50,
          verificationMethod: issuerVerificationMethod,
        },
        credentialEndpointConfig: {
          enabled: true,
          verificationMethod: issuerVerificationMethod,
          credentialRequestToCredentialMapper: async (credentialRequest, metadata) => {
            if (
              credentialRequest.format === 'vc+sd-jwt' &&
              credentialRequest.credential_definition.vct === 'UniversityDegreeCredential'
            ) {
              if (metadata.holderDid !== holderDid) throw new Error('Invalid holder did')

              const { compact } = await issuer.modules.sdJwtVc.create(
                { type: 'UniversityDegreeCredential', university: 'innsbruck', degree: 'bachelor' },
                {
                  holderDidUrl: metadata.holderDidUrl,
                  issuerDidUrl: issuerKid,
                  disclosureFrame: { university: true, degree: true },
                }
              )
              return compact
            }
            throw new Error('Invalid request')
          },
        },
      })

      issuerApp.use('/', router)
      issuerServer = issuerApp.listen(issuerPort)

      const { credentialOfferRequest } = await issuer.modules.openId4VcIssuer.createCredentialOfferAndRequest(
        [universityDegreeCredentialSdJwt.id],
        { preAuthorizedCodeFlowConfig: { userPinRequired: false }, ...baseCredentialRequestOptions }
      )

      const resolvedCredentialOffer = await holder.modules.openId4VcHolder.resolveCredentialOffer(
        credentialOfferRequest
      )

      const credentials = await holder.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
        resolvedCredentialOffer,
        {
          proofOfPossessionVerificationMethodResolver: async () => {
            return holderVerificationMethod
          },
        }
      )

      expect(credentials).toHaveLength(1)
      if (credentials[0].type === 'W3cCredentialRecord') throw new Error('Invalid credential type')
      expect(credentials[0].sdJwtVc.payload['type']).toEqual('UniversityDegreeCredential')
    })

    //it('authorization code flow https://portal.walt.id/', async () => {
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
})
