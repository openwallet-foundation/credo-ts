import '@openwallet-foundation/askar-nodejs'
import {
  Agent,
  ClaimFormat,
  DidKey,
  getCredentialHolderBindingDids,
  type KeyDidCreateOptions,
  Kms,
  MdocRecord,
  SdJwtVcRecord,
  TypedArrayEncoder,
  W3cCredential,
  W3cCredentialRecord,
  W3cCredentialService,
  W3cCredentialSubject,
  W3cIssuer,
  W3cJwtVerifiableCredential,
  W3cV2Credential,
  W3cV2CredentialRecord,
  W3cV2CredentialSubject,
  W3cV2Issuer,
  w3cDate,
} from '@credo-ts/core'
import type { IssuerMetadataResult } from '@openid4vc/openid4vci'
import nock from 'nock'
import { InMemoryWalletModule } from '../../../../../tests/InMemoryWalletModule'
import { transformPrivateKeyToPrivateJwk } from '../../../../askar/src'
import { agentDependencies } from '../../../../node/src'
import { OpenId4VcModule } from '../../OpenId4VcModule'
import {
  type OpenId4VciCredentialConfigurationSupportedWithFormats,
  OpenId4VciCredentialFormatProfile,
} from '../../shared'
import { OpenId4VciHolderService } from '../OpenId4VciHolderService'
import { OpenId4VciAuthorizationFlow } from '../OpenId4VciHolderServiceOptions'
import { animoOpenIdPlaygroundDraft11SdJwtVc, matrrLaunchpadDraft11JwtVcJson, waltIdDraft11JwtVcJson } from './fixtures'

const holder = new Agent({
  config: {},
  dependencies: agentDependencies,
  modules: {
    openid4vc: new OpenId4VcModule(),
    inMemory: new InMemoryWalletModule(),
  },
})

describe('OpenId4VcHolder', () => {
  let holderKey: Kms.PublicJwk
  let holderDid: string
  let holderVerificationMethod: string

  beforeEach(async () => {
    await holder.initialize()

    const key = await holder.kms.importKey({
      privateJwk: transformPrivateKeyToPrivateJwk({
        privateKey: TypedArrayEncoder.fromUtf8String('96213c3d7fc8d4d6754c7a0fd969598e'),
        type: {
          kty: 'OKP',
          crv: 'Ed25519',
        },
      }).privateJwk,
    })
    holderKey = Kms.PublicJwk.fromPublicJwk(key.publicJwk)

    const {
      didState: { did },
    } = await holder.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: {
        keyId: key.keyId,
      },
    })

    if (!did) throw new Error('expected did')

    const holderDidKey = DidKey.fromDid(did)
    holderDid = holderDidKey.did
    holderVerificationMethod = `${holderDidKey.did}#${holderDidKey.publicJwk.fingerprint}`
  })

  afterEach(async () => {
    await holder.shutdown()
  })

  describe('[DRAFT 11]: Pre-authorized flow', () => {
    afterEach(() => {
      nock.cleanAll()
      nock.enableNetConnect()
    })

    it('Should successfully receive credential from MATTR launchpad using the pre-authorized flow using a did:key Ed25519 subject and jwt_vc_json credential', async () => {
      const fixture = matrrLaunchpadDraft11JwtVcJson

      /**
       *  Below we're setting up some mock HTTP responses.
       *  These responses are based on the openid-initiate-issuance URI above
       * */
      // setup temporary redirect mock
      nock('https://launchpad.mattrlabs.com').get('/.well-known/openid-credential-issuer').reply(307, undefined, {
        Location: 'https://launchpad.vii.electron.mattrlabs.io/.well-known/openid-credential-issuer',
      })

      // setup server metadata response
      nock('https://launchpad.vii.electron.mattrlabs.io')
        .get('/.well-known/did.json')
        .reply(200, fixture.wellKnownDid)

        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.getMetadataResponse)

        .get('/.well-known/oauth-authorization-server')
        .reply(404)

        .get('/.well-known/openid-configuration')
        .reply(404)

        // setup access token response
        .post('/oidc/v1/auth/token')
        .reply(200, fixture.acquireAccessTokenResponse)

        // setup credential request response
        .post('/oidc/v1/auth/credential')
        .reply(200, fixture.credentialResponse)

      const resolved = await holder.openid4vc.holder.resolveCredentialOffer(fixture.credentialOffer)
      const accessTokenResponse = await holder.openid4vc.holder.requestToken({
        resolvedCredentialOffer: resolved,
      })

      // The credential issued by mattr launchpad is expired, so we mock the verification...
      const w3cCredentialService = holder.dependencyManager.resolve(W3cCredentialService)
      vi.spyOn(w3cCredentialService, 'verifyCredential').mockImplementationOnce(async () => ({
        isValid: true,
        validations: {},
      }))

      const credentialsResult = await holder.openid4vc.holder.requestCredentials({
        resolvedCredentialOffer: resolved,
        ...accessTokenResponse,

        verifyCredentialStatus: false,
        // We only allow EdDSa, as we've created a did with keyType ed25519. If we create
        // or determine the did dynamically we could use any signature algorithm
        allowedProofOfPossessionSignatureAlgorithms: [Kms.KnownJwaSignatureAlgorithms.EdDSA],
        credentialConfigurationIds: Object.entries(resolved.offeredCredentialConfigurations)
          .filter(([, configuration]) => configuration.format === 'jwt_vc_json')
          .map(([id]) => id),
        credentialBindingResolver: () => ({
          method: 'did',
          didUrls: [holderVerificationMethod],
          createdForCredential: true,
        }),
      })

      expect(credentialsResult.credentials).toHaveLength(1)
      const w3cCredential = (credentialsResult.credentials[0].record as W3cCredentialRecord).firstCredential
      expect(w3cCredential).toBeInstanceOf(W3cJwtVerifiableCredential)

      expect(w3cCredential.type).toEqual(['VerifiableCredential', 'OpenBadgeCredential'])
      expect(w3cCredential.credentialSubjectIds[0]).toEqual(holderDid)

      // Stored so that deleting the credential with `deleteAssociatedKeys` also deletes the DID
      expect(getCredentialHolderBindingDids(credentialsResult.credentials[0].record)).toEqual([holderDid])
    })

    it('Should successfully receive credential from walt.id using the pre-authorized flow using a did:key Ed25519 subject and jwt_vc_json credential', async () => {
      const fixture = waltIdDraft11JwtVcJson

      // setup server metadata response
      nock('https://issuer.portal.walt.id')
        // openid configuration is same as issuer metadata for walt.id
        .get('/.well-known/openid-configuration')
        .reply(200, fixture.getMetadataResponse)

        .get('/.well-known/oauth-authorization-server')
        .reply(404)

        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.getMetadataResponse)

        // setup access token response
        .post('/token')
        .reply(200, fixture.acquireAccessTokenResponse)

        // setup credential request response
        .post('/credential')
        .reply(200, fixture.credentialResponse)

      const resolved = await holder.openid4vc.holder.resolveCredentialOffer(fixture.credentialOfferPreAuth)
      const accessTokenResponse = await holder.openid4vc.holder.requestToken({
        resolvedCredentialOffer: resolved,
      })

      await expect(() =>
        holder.openid4vc.holder.requestCredentials({
          resolvedCredentialOffer: resolved,
          ...accessTokenResponse,
          verifyCredentialStatus: false,
          // We only allow EdDSa, as we've created a did with keyType ed25519. If we create
          // or determine the did dynamically we could use any signature algorithm
          allowedProofOfPossessionSignatureAlgorithms: [Kms.KnownJwaSignatureAlgorithms.EdDSA],
          credentialConfigurationIds: Object.entries(resolved.offeredCredentialConfigurations)
            .filter(([, configuration]) => configuration.format === 'jwt_vc_json')
            .map(([id]) => id),
          credentialBindingResolver: () => ({ method: 'did', didUrls: [holderVerificationMethod] }),
        })
      )
        // FIXME: walt.id issues jwt where nbf and issuanceDate do not match
        .rejects.toThrow('JWT nbf and vc.issuanceDate do not match')
    })

    it('Should successfully receive credential from animo openid4vc playground using the pre-authorized flow using a jwk EdDSA subject and vc+sd-jwt credential', async () => {
      const fixture = animoOpenIdPlaygroundDraft11SdJwtVc

      nock('https://openid4vc.animo.id')
        .get('/.well-known/oauth-authorization-server/oid4vci/0bbfb1c0-9f45-478c-a139-08f6ed610a37')
        .reply(404)

        .get('/.well-known/openid-credential-issuer/oid4vci/0bbfb1c0-9f45-478c-a139-08f6ed610a37')
        .reply(404)

      // setup server metadata response
      nock('https://openid4vc.animo.id/oid4vci/0bbfb1c0-9f45-478c-a139-08f6ed610a37')
        .get('/.well-known/openid-configuration')
        .reply(404)

        .get('/.well-known/oauth-authorization-server')
        .reply(404)

        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.getMetadataResponse)

        // setup access token response
        .post('/token')
        .reply(200, fixture.acquireAccessTokenResponse)

        // setup credential request response
        .post('/credential')
        .reply(200, fixture.credentialResponse)

        .post('/notification')
        .reply(204, 'No Content')

      const resolvedCredentialOffer = await holder.openid4vc.holder.resolveCredentialOffer(fixture.credentialOffer)

      const tokenResponse = await holder.openid4vc.holder.requestToken({
        resolvedCredentialOffer,
      })

      const credentialResponse = await holder.openid4vc.holder.requestCredentials({
        resolvedCredentialOffer,
        ...tokenResponse,
        verifyCredentialStatus: false,
        // We only allow EdDSa, as we've created a did with keyType ed25519. If we create
        // or determine the did dynamically we could use any signature algorithm
        allowedProofOfPossessionSignatureAlgorithms: [Kms.KnownJwaSignatureAlgorithms.EdDSA],
        credentialConfigurationIds: Object.entries(resolvedCredentialOffer.offeredCredentialConfigurations)
          .filter(([, configuration]) => configuration.format === 'dc+sd-jwt')
          .map(([id]) => id),
        credentialBindingResolver: () => ({ method: 'jwk', keys: [holderKey] }),
      })

      if (!credentialResponse.credentials[0]?.notificationId) throw new Error("Notification metadata wasn't returned")

      await holder.openid4vc.holder.sendNotification({
        accessToken: tokenResponse.accessToken,
        notificationEvent: 'credential_accepted',
        notificationId: credentialResponse.credentials[0]?.notificationId,
        metadata: resolvedCredentialOffer.metadata,
        dpop: credentialResponse.dpop,
      })

      expect(credentialResponse.credentials).toHaveLength(1)
      const credential = (credentialResponse.credentials[0].record as SdJwtVcRecord).firstCredential
      expect(credential).toEqual({
        claimFormat: 'dc+sd-jwt',
        compact:
          'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCIsImtpZCI6IiN6Nk1raDVITlBDQ0pXWm42V1JMalJQdHR5dllaQnNrWlVkU0pmVGlad2NVU2llcXgifQ.eyJ2Y3QiOiJBbmltb09wZW5JZDRWY1BsYXlncm91bmQiLCJwbGF5Z3JvdW5kIjp7ImZyYW1ld29yayI6IkFyaWVzIEZyYW1ld29yayBKYXZhU2NyaXB0IiwiY3JlYXRlZEJ5IjoiQW5pbW8gU29sdXRpb25zIiwiX3NkIjpbImZZM0ZqUHpZSEZOcHlZZnRnVl9kX25DMlRHSVh4UnZocE00VHdrMk1yMDQiLCJwTnNqdmZJeVBZOEQwTks1c1l0alR2Nkc2R0FNVDNLTjdaZDNVNDAwZ1pZIl19LCJjbmYiOnsiandrIjp7Imt0eSI6Ik9LUCIsImNydiI6IkVkMjU1MTkiLCJ4Ijoia2MydGxwaGNadzFBSUt5a3pNNnBjY2k2UXNLQW9jWXpGTC01RmUzNmg2RSJ9fSwiaXNzIjoiZGlkOmtleTp6Nk1raDVITlBDQ0pXWm42V1JMalJQdHR5dllaQnNrWlVkU0pmVGlad2NVU2llcXgiLCJpYXQiOjE3MDU4NDM1NzQsIl9zZF9hbGciOiJzaGEtMjU2In0.2iAjaCFcuiHXTfQsrxXo6BghtwzqTrfDmhmarAAJAhY8r9yKXY3d10JY1dry2KnaEYWpq2R786thjdA5BXlPAQ~WyI5MzM3MTM0NzU4NDM3MjYyODY3NTE4NzkiLCJsYW5ndWFnZSIsIlR5cGVTY3JpcHQiXQ~WyIxMTQ3MDA5ODk2Nzc2MDYzOTc1MDUwOTMxIiwidmVyc2lvbiIsIjEuMCJd~',
        encoded:
          'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCIsImtpZCI6IiN6Nk1raDVITlBDQ0pXWm42V1JMalJQdHR5dllaQnNrWlVkU0pmVGlad2NVU2llcXgifQ.eyJ2Y3QiOiJBbmltb09wZW5JZDRWY1BsYXlncm91bmQiLCJwbGF5Z3JvdW5kIjp7ImZyYW1ld29yayI6IkFyaWVzIEZyYW1ld29yayBKYXZhU2NyaXB0IiwiY3JlYXRlZEJ5IjoiQW5pbW8gU29sdXRpb25zIiwiX3NkIjpbImZZM0ZqUHpZSEZOcHlZZnRnVl9kX25DMlRHSVh4UnZocE00VHdrMk1yMDQiLCJwTnNqdmZJeVBZOEQwTks1c1l0alR2Nkc2R0FNVDNLTjdaZDNVNDAwZ1pZIl19LCJjbmYiOnsiandrIjp7Imt0eSI6Ik9LUCIsImNydiI6IkVkMjU1MTkiLCJ4Ijoia2MydGxwaGNadzFBSUt5a3pNNnBjY2k2UXNLQW9jWXpGTC01RmUzNmg2RSJ9fSwiaXNzIjoiZGlkOmtleTp6Nk1raDVITlBDQ0pXWm42V1JMalJQdHR5dllaQnNrWlVkU0pmVGlad2NVU2llcXgiLCJpYXQiOjE3MDU4NDM1NzQsIl9zZF9hbGciOiJzaGEtMjU2In0.2iAjaCFcuiHXTfQsrxXo6BghtwzqTrfDmhmarAAJAhY8r9yKXY3d10JY1dry2KnaEYWpq2R786thjdA5BXlPAQ~WyI5MzM3MTM0NzU4NDM3MjYyODY3NTE4NzkiLCJsYW5ndWFnZSIsIlR5cGVTY3JpcHQiXQ~WyIxMTQ3MDA5ODk2Nzc2MDYzOTc1MDUwOTMxIiwidmVyc2lvbiIsIjEuMCJd~',
        header: {
          alg: 'EdDSA',
          kid: '#z6Mkh5HNPCCJWZn6WRLjRPttyvYZBskZUdSJfTiZwcUSieqx',
          typ: 'vc+sd-jwt',
        },
        issuer: {
          method: 'did',
          didUrl:
            'did:key:z6Mkh5HNPCCJWZn6WRLjRPttyvYZBskZUdSJfTiZwcUSieqx#z6Mkh5HNPCCJWZn6WRLjRPttyvYZBskZUdSJfTiZwcUSieqx',
        },
        holder: {
          jwk: {
            jwk: {
              jwk: {
                crv: 'Ed25519',
                kty: 'OKP',
                x: 'kc2tlphcZw1AIKykzM6pcci6QsKAocYzFL-5Fe36h6E',
              },
              multicodecPrefix: 237,
              supportedEncryptionKeyAgreementAlgorithms: [],
              supportedSignatureAlgorithms: ['EdDSA', 'Ed25519'],
            },
          },
          method: 'jwk',
        },
        kbJwt: undefined,
        kmsKeyId: expect.any(String),
        payload: {
          _sd_alg: 'sha-256',
          cnf: {
            jwk: {
              crv: 'Ed25519',
              kty: 'OKP',
              x: 'kc2tlphcZw1AIKykzM6pcci6QsKAocYzFL-5Fe36h6E',
            },
          },
          iat: 1705843574,
          iss: 'did:key:z6Mkh5HNPCCJWZn6WRLjRPttyvYZBskZUdSJfTiZwcUSieqx',
          playground: {
            _sd: ['fY3FjPzYHFNpyYftgV_d_nC2TGIXxRvhpM4Twk2Mr04', 'pNsjvfIyPY8D0NK5sYtjTv6G6GAMT3KN7Zd3U400gZY'],
            createdBy: 'Animo Solutions',
            framework: 'Aries Framework JavaScript',
          },
          vct: 'AnimoOpenId4VcPlayground',
        },
        prettyClaims: {
          cnf: {
            jwk: {
              crv: 'Ed25519',
              kty: 'OKP',
              x: 'kc2tlphcZw1AIKykzM6pcci6QsKAocYzFL-5Fe36h6E',
            },
          },
          iat: 1705843574,
          iss: 'did:key:z6Mkh5HNPCCJWZn6WRLjRPttyvYZBskZUdSJfTiZwcUSieqx',
          playground: {
            createdBy: 'Animo Solutions',
            framework: 'Aries Framework JavaScript',
            language: 'TypeScript',
            version: '1.0',
          },
          vct: 'AnimoOpenId4VcPlayground',
        },
      })
    })
  })

  describe('[DRAFT 11]: Authorization flow', () => {
    afterAll(() => {
      nock.cleanAll()
      nock.enableNetConnect()
    })

    it('Should successfully receive credential from walt.id using the authorized flow using a did:key Ed25519 subject and jwt_vc_json credential', async () => {
      const fixture = waltIdDraft11JwtVcJson

      // setup temporary redirect mock
      nock('https://issuer.portal.walt.id')
        .get('/.well-known/openid-credential-issuer')
        .reply(200, fixture.getMetadataResponse)
        .get('/.well-known/oauth-authorization-server')
        .reply(404)
        .get('/.well-known/openid-configuration')
        .reply(200, fixture.getMetadataResponse)
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

      const resolvedCredentialOffer = await holder.openid4vc.holder.resolveCredentialOffer(fixture.credentialOfferAuth)

      const resolvedAuthorizationRequest = await holder.openid4vc.holder.resolveOpenId4VciAuthorizationRequest(
        resolvedCredentialOffer,
        {
          clientId: 'test-client',
          redirectUri: 'http://example.com',
          scope: ['openid', 'UniversityDegree'],
        }
      )

      if (resolvedAuthorizationRequest.authorizationFlow === OpenId4VciAuthorizationFlow.PresentationDuringIssuance) {
        throw new Error('unexpected authorization flow')
      }

      const tokenResponse = await holder.openid4vc.holder.requestToken({
        resolvedCredentialOffer,
        clientId: 'test-client',
        redirectUri: 'https://example.com',
        code: fixture.authorizationCode,
      })

      await expect(
        holder.openid4vc.holder.requestCredentials({
          resolvedCredentialOffer,
          ...tokenResponse,
          allowedProofOfPossessionSignatureAlgorithms: [Kms.KnownJwaSignatureAlgorithms.EdDSA],
          credentialBindingResolver: () => ({ method: 'did', didUrls: [holderVerificationMethod] }),
          verifyCredentialStatus: false,
        })
      )
        // FIXME: credential returned by walt.id has nbf and issuanceDate that do not match
        // but we know that we at least received the credential if we got to this error
        .rejects.toThrow('JWT nbf and vc.issuanceDate do not match')
    })
  })

  describe('proof of possession requirements', () => {
    const getSupportedSignatureAlgorithms = (proofSigningAlgValuesSupported: string[]) => {
      const holderService = holder.dependencyManager.resolve(OpenId4VciHolderService)

      // biome-ignore lint/complexity/useLiteralKeys: bracket access calls the private method with its real types
      return holderService['getProofOfPossessionRequirements'](holder.context, {
        // Only read when the configuration has no proof_types_supported
        metadata: {} as IssuerMetadataResult,
        credentialToRequest: {
          id: 'ldpVc',
          configuration: {
            format: OpenId4VciCredentialFormatProfile.LdpVc,
            credential_definition: { '@context': [], type: ['VerifiableCredential'] },
            proof_types_supported: { jwt: { proof_signing_alg_values_supported: proofSigningAlgValuesSupported } },
          },
        },
        possibleProofOfPossessionSignatureAlgorithms: ['EdDSA', 'ES256'],
      }).proofTypes.jwt?.supportedSignatureAlgorithms
    }

    it.each([
      [['Ed25519Signature2018'], ['EdDSA']],
      [['Ed25519Signature2020'], ['EdDSA']],
      [['Ed25519Signature2018', 'Ed25519Signature2020'], ['EdDSA']],
      [['EcdsaSecp256r1Signature2019'], []],
    ])('keeps the algorithms for which a suite with an ldp_vc proof type in %j exists', (proofTypes, algorithms) => {
      expect(getSupportedSignatureAlgorithms(proofTypes)).toEqual(algorithms)
    })
  })

  describe('type of an issued credential', () => {
    afterEach(() => {
      nock.cleanAll()
      holder.x509.config.setTrustedCertificates(undefined)
    })

    const handleCredentialResponse = (
      {
        credential,
        jwkThumbprintKmsKeyIdMapping,
      }: { credential: string | Record<string, unknown>; jwkThumbprintKmsKeyIdMapping?: Record<string, string> },
      credentialConfiguration: OpenId4VciCredentialConfigurationSupportedWithFormats
    ) => {
      const holderService = holder.dependencyManager.resolve(OpenId4VciHolderService)

      // biome-ignore lint/complexity/useLiteralKeys: bracket access calls the private method with its real types
      return holderService['handleCredentialResponse'](
        holder.context,
        { credentials: [{ credential }] },
        {
          verifyCredentialStatus: false,
          format: credentialConfiguration.format as OpenId4VciCredentialFormatProfile,
          credentialConfigurationId: 'configurationId',
          credentialConfiguration,
          jwkThumbprintKmsKeyIdMapping,
        }
      )
    }

    it('accepts a jwt_vc_json credential for its credential configuration, and rejects it for another type', async () => {
      const issuerKey = await holder.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
      const {
        didState: { did: issuerDid },
      } = await holder.dids.create<KeyDidCreateOptions>({ method: 'key', options: { keyId: issuerKey.keyId } })
      if (!issuerDid) throw new Error('expected did')
      const issuerDidKey = DidKey.fromDid(issuerDid)

      const { encoded } = await holder.w3cCredentials.signCredential({
        format: ClaimFormat.JwtVc,
        credential: new W3cCredential({
          type: ['VerifiableCredential', 'BarCredential'],
          issuer: new W3cIssuer({ id: issuerDidKey.did }),
          credentialSubject: new W3cCredentialSubject({ id: holderDid, claims: { number: '123456789' } }),
          issuanceDate: w3cDate(Date.now()),
        }),
        verificationMethod: `${issuerDidKey.did}#${issuerDidKey.publicJwk.fingerprint}`,
        alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      })

      await expect(
        handleCredentialResponse(
          { credential: encoded },
          {
            format: OpenId4VciCredentialFormatProfile.JwtVcJson,
            credential_definition: { type: ['VerifiableCredential', 'BarCredential'] },
          }
        )
      ).resolves.toMatchObject({ record: expect.any(W3cCredentialRecord) })
      await expect(
        handleCredentialResponse(
          { credential: encoded },
          {
            proof_types_supported: {
              jwt: { proof_signing_alg_values_supported: ['EdDSA', 'ES256', 'ES256K'] },
            },
            format: OpenId4VciCredentialFormatProfile.JwtVcJson,
            credential_definition: { type: ['VerifiableCredential', 'FooCredential'] },
          }
        )
      ).rejects.toThrow(
        "Expected the credential type to include each type of the credential configuration, 'VerifiableCredential', 'FooCredential', received 'VerifiableCredential', 'BarCredential'."
      )
    })

    it('accepts an ldp_vc credential for its credential configuration, and rejects it for another type', async () => {
      const { encoded } = await holder.w3cCredentials.signCredential({
        format: ClaimFormat.LdpVc,
        credential: new W3cCredential({
          type: ['VerifiableCredential'],
          issuer: new W3cIssuer({ id: holderDid }),
          credentialSubject: new W3cCredentialSubject({ id: holderDid }),
          issuanceDate: w3cDate(Date.now()),
        }),
        verificationMethod: holderVerificationMethod,
      })
      const credential = { credential: encoded as Record<string, unknown> }

      await expect(
        handleCredentialResponse(credential, {
          format: OpenId4VciCredentialFormatProfile.LdpVc,
          credential_definition: {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            type: ['VerifiableCredential'],
          },
        })
      ).resolves.toMatchObject({ record: expect.any(W3cCredentialRecord) })
      await expect(
        handleCredentialResponse(credential, {
          format: OpenId4VciCredentialFormatProfile.LdpVc,
          credential_definition: {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            type: ['VerifiableCredential', 'OpenBadgeCredential'],
          },
        })
      ).rejects.toThrow(
        "Expected the credential type to include each type of the credential configuration, 'VerifiableCredential', 'OpenBadgeCredential', received 'VerifiableCredential'."
      )
    })

    it('accepts a W3C vc+sd-jwt credential for its credential configuration, and rejects it for another type', async () => {
      const { encoded } = await holder.w3cV2Credentials.signCredential({
        format: ClaimFormat.SdJwtW3cVc,
        credential: new W3cV2Credential({
          type: ['VerifiableCredential', 'OpenBadgeCredential'],
          issuer: new W3cV2Issuer({ id: holderDid }),
          credentialSubject: new W3cV2CredentialSubject({ id: holderDid }),
          validFrom: w3cDate(Date.now()),
        }),
        verificationMethod: holderVerificationMethod,
        alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      })

      await expect(
        handleCredentialResponse(
          { credential: encoded },
          {
            format: OpenId4VciCredentialFormatProfile.SdJwtVc,
            credential_definition: { type: ['VerifiableCredential', 'OpenBadgeCredential'] },
          }
        )
      ).resolves.toMatchObject({ record: expect.any(W3cV2CredentialRecord) })
      await expect(
        handleCredentialResponse(
          { credential: encoded },
          {
            format: OpenId4VciCredentialFormatProfile.SdJwtVc,
            credential_definition: { type: ['VerifiableCredential', 'UniversityDegreeCredential'] },
          }
        )
      ).rejects.toThrow(
        "Expected the credential type to include each type of the credential configuration, 'VerifiableCredential', 'UniversityDegreeCredential', received 'VerifiableCredential', 'OpenBadgeCredential'."
      )
    })

    it('accepts an mdoc for its credential configuration, and rejects it for another doctype', async () => {
      const issuerCertificate = await holder.x509.createCertificate({
        authorityKey: Kms.PublicJwk.fromPublicJwk(
          (await holder.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
        ),
        issuer: 'C=NL',
      })
      holder.x509.config.setTrustedCertificates([issuerCertificate])

      const deviceKey = Kms.PublicJwk.fromPublicJwk(
        (await holder.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
      )
      const mdoc = await holder.mdoc.sign({
        docType: 'org.iso.18013.5.1.mDL',
        validityInfo: { validUntil: new Date(Date.now() + 60 * 60 * 1000) },
        holderKey: deviceKey,
        issuerCertificate,
        namespaces: { 'org.iso.18013.5.1': { given_name: 'Jane' } },
      })
      const credential = {
        credential: mdoc.base64Url,
        jwkThumbprintKmsKeyIdMapping: {
          [TypedArrayEncoder.toBase64(deviceKey.getJwkThumbprint())]: deviceKey.keyId,
        },
      }

      await expect(
        handleCredentialResponse(credential, {
          format: OpenId4VciCredentialFormatProfile.MsoMdoc,
          doctype: 'org.iso.18013.5.1.mDL',
        })
      ).resolves.toMatchObject({ record: expect.any(MdocRecord) })
      await expect(
        handleCredentialResponse(credential, {
          format: OpenId4VciCredentialFormatProfile.MsoMdoc,
          doctype: 'org.iso.23220.photoid.1',
        })
      ).rejects.toThrow(
        "Expected the credential doctype to be the doctype of the credential configuration, 'org.iso.23220.photoid.1', received 'org.iso.18013.5.1.mDL'."
      )
    })

    const pidConfiguration = {
      format: OpenId4VciCredentialFormatProfile.SdJwtDc,
      vct: 'https://example.com/pid',
    } satisfies OpenId4VciCredentialConfigurationSupportedWithFormats

    const signSdJwtVc = async (vct: string) => ({
      credential: (
        await holder.sdJwtVc.sign({
          payload: { vct },
          holder: { method: 'did', didUrl: holderVerificationMethod },
          issuer: { method: 'did', didUrl: holderVerificationMethod },
        })
      ).compact,
    })

    it('accepts an SD-JWT VC whose vct extends the vct of the credential configuration', async () => {
      nock('https://example.com')
        .get('/pid-extended')
        .reply(200, { vct: 'https://example.com/pid-extended', extends: pidConfiguration.vct })
        .get('/pid')
        .reply(200, { vct: pidConfiguration.vct })

      await expect(
        handleCredentialResponse(await signSdJwtVc('https://example.com/pid-extended'), pidConfiguration)
      ).resolves.toMatchObject({ record: expect.any(SdJwtVcRecord) })
    })

    it('rejects an SD-JWT VC with another vct than the credential configuration', async () => {
      nock('https://example.com').get('/other').reply(200, { vct: 'https://example.com/other' })

      await expect(
        handleCredentialResponse(await signSdJwtVc('https://example.com/other'), pidConfiguration)
      ).rejects.toThrow(
        "Expected the credential vct to be the vct of the credential configuration, 'https://example.com/pid', or one that extends it, received 'https://example.com/other'."
      )
    })
  })
})
