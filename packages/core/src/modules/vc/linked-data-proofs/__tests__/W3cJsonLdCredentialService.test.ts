import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../../../../../tests/InMemoryStorageService'
import { transformPrivateKeyToPrivateJwk } from '../../../../../../askar/src'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../../../../tests/helpers'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../../constants'
import { ConsoleLogger, LogLevel } from '../../../../logger'
import { asArray, TypedArrayEncoder } from '../../../../utils'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import {
  DidDocument,
  DidKey,
  DidRepository,
  DidsApi,
  DidsModuleConfig,
  type KeyDidCreateOptions,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
} from '../../../dids'
import { Ed25519PublicJwk, KeyManagementApi, PublicJwk } from '../../../kms'
import { CREDENTIALS_CONTEXT_V2_URL } from '../../constants'
import { DEFAULT_CONTEXTS } from '../../jsonld/contexts'
import { ClaimFormat, W3cCredential } from '../../models'
import { W3cPresentation } from '../../models/presentation/W3cPresentation'
import { W3cCredentialsModuleConfig } from '../../W3cCredentialsModuleConfig'
import { purposes } from '../adapters/jsonld-signatures-adapter'
import { LinkedDataProof } from '../models/LinkedDataProof'
import { W3cJsonLdVerifiableCredential } from '../models/W3cJsonLdVerifiableCredential'
import { W3cJsonLdVerifiablePresentation } from '../models/W3cJsonLdVerifiablePresentation'
import { CredentialIssuancePurpose } from '../proof-purposes/CredentialIssuancePurpose'
import { SignatureSuiteRegistry } from '../SignatureSuiteRegistry'
import { Ed25519Signature2018, Ed25519Signature2020 } from '../signature-suites'
import { W3cJsonLdCredentialService } from '../W3cJsonLdCredentialService'
import { customDocumentLoader } from './documentLoader'
import { Ed25519Signature2018Fixtures } from './fixtures'

const AuthenticationProofPurpose = purposes.AuthenticationProofPurpose

const signatureSuiteRegistry = new SignatureSuiteRegistry([
  {
    suiteClass: Ed25519Signature2018,
    proofType: 'Ed25519Signature2018',

    verificationMethodTypes: [
      VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
      VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
    ],
    supportedPublicJwkTypes: [Ed25519PublicJwk],
  },
])

// biome-ignore lint/suspicious/noExplicitAny: no explanation
const inMemoryStorage = new InMemoryStorageService<any>()
const agentConfig = getAgentConfig('W3cJsonLdCredentialServiceTest')
const agentContext = getAgentContext({
  agentConfig,
  registerInstances: [
    [InjectionSymbols.Logger, new ConsoleLogger(LogLevel.Off)],
    [DidsModuleConfig, new DidsModuleConfig({})],
    [DidRepository, new DidRepository(inMemoryStorage, new EventEmitter(agentDependencies, new Subject()))],
  ],
})

const w3cJsonLdCredentialService = new W3cJsonLdCredentialService(
  signatureSuiteRegistry,
  new W3cCredentialsModuleConfig({
    documentLoader: customDocumentLoader,
  })
)

describe('W3cJsonLdCredentialsService', () => {
  const privateKey = TypedArrayEncoder.fromUtf8String('testseed000000000000000000000001')

  describe('Utility methods', () => {
    describe('getVerificationMethodTypesByProofType', () => {
      it('should return the correct key types for Ed25519Signature2018 proof type', async () => {
        const verificationMethodTypes =
          w3cJsonLdCredentialService.getVerificationMethodTypesByProofType('Ed25519Signature2018')
        expect(verificationMethodTypes).toEqual([
          VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
          VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
        ])
      })
    })
  })

  describe('Ed25519Signature2018', () => {
    let issuerDidKey: DidKey
    let verificationMethod: string

    beforeAll(async () => {
      const kms = agentContext.resolve(KeyManagementApi)
      const dids = agentContext.resolve(DidsApi)

      const importedKey = await kms.importKey({
        privateJwk: transformPrivateKeyToPrivateJwk({
          privateKey,
          type: {
            crv: 'Ed25519',
            kty: 'OKP',
          },
        }).privateJwk,
      })
      const issuerKey = PublicJwk.fromPublicJwk(importedKey.publicJwk)

      await dids.create<KeyDidCreateOptions>({
        method: 'key',
        options: {
          keyId: importedKey.keyId,
        },
      })

      issuerDidKey = new DidKey(issuerKey)
      verificationMethod = `${issuerDidKey.did}#${issuerDidKey.publicJwk.fingerprint}`
    })

    describe('signCredential', () => {
      it('should return a successfully signed credential', async () => {
        const credentialJson = Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT

        const credential = JsonTransformer.fromJSON(credentialJson, W3cCredential)

        const vc = await w3cJsonLdCredentialService.signCredential(agentContext, {
          format: ClaimFormat.LdpVc,
          credential,
          proofType: 'Ed25519Signature2018',
          verificationMethod: verificationMethod,
        })

        expect(vc).toBeInstanceOf(W3cJsonLdVerifiableCredential)
        expect(vc.issuer).toEqual(issuerDidKey.did)
        expect(Array.isArray(vc.proof)).toBe(false)
        expect(vc.proof).toBeInstanceOf(LinkedDataProof)

        expect(asArray(vc.proof)[0].verificationMethod).toEqual(verificationMethod)
      })

      it('should throw because of verificationMethod does not belong to this wallet', async () => {
        const credentialJson = Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT
        credentialJson.issuer = issuerDidKey.did

        const credential = JsonTransformer.fromJSON(credentialJson, W3cCredential)

        await expect(async () => {
          await w3cJsonLdCredentialService.signCredential(agentContext, {
            format: ClaimFormat.LdpVc,
            credential,
            proofType: 'Ed25519Signature2018',
            verificationMethod:
              'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV#z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV',
          })
        }).rejects.toThrow(`Created did 'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV' not found`)
      })

      it('calls resolveVerificationMethodFromCreatedDidRecord with assertionMethod purpose', async () => {
        const spy = vi.spyOn(DidsApi.prototype, 'resolveVerificationMethodFromCreatedDidRecord')

        const credential = JsonTransformer.fromJSON(Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT, W3cCredential)

        await w3cJsonLdCredentialService.signCredential(agentContext, {
          format: ClaimFormat.LdpVc,
          credential,
          proofType: 'Ed25519Signature2018',
          verificationMethod,
        })

        expect(spy).toHaveBeenCalledWith(verificationMethod, ['assertionMethod'])
        spy.mockRestore()
      })

      it('does not call document loader with issuer VM DID URL for key lookup', async () => {
        const innerLoader = vi.fn(async (url: string) => customDocumentLoader()(url))

        const trackingDocumentLoader = (_agentContext?: unknown) => innerLoader

        const serviceWithTrackingLoader = new W3cJsonLdCredentialService(
          signatureSuiteRegistry,
          new W3cCredentialsModuleConfig({ documentLoader: trackingDocumentLoader })
        )

        const credential = JsonTransformer.fromJSON(Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT, W3cCredential)

        const result = await serviceWithTrackingLoader.signCredential(agentContext, {
          format: ClaimFormat.LdpVc,
          credential,
          proofType: 'Ed25519Signature2018',
          verificationMethod,
        })

        const didUrlCalls = innerLoader.mock.calls.filter(([url]) => url.startsWith('did:'))
        expect(didUrlCalls).toHaveLength(0)

        expect(result).toBeInstanceOf(W3cJsonLdVerifiableCredential)
        expect(asArray(result.proof)[0].verificationMethod).toEqual(verificationMethod)
      })

      it('rejects a verification method not authorized for assertionMethod', async () => {
        const kms = agentContext.resolve(KeyManagementApi)
        const didRepository = agentContext.resolve(DidRepository)

        const authOnlyKey = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
        const authOnlyDid = 'did:example:auth-only-test'
        const authOnlyVmId = `${authOnlyDid}#auth-key`

        await didRepository.storeCreatedDid(agentContext, {
          did: authOnlyDid,
          didDocument: JsonTransformer.fromJSON(
            {
              '@context': ['https://www.w3.org/ns/did/v1'],
              id: authOnlyDid,
              verificationMethod: [
                {
                  id: authOnlyVmId,
                  type: 'JsonWebKey2020',
                  controller: authOnlyDid,
                  publicKeyJwk: authOnlyKey.publicJwk,
                },
              ],
              authentication: [authOnlyVmId],
            },
            DidDocument
          ),
          keys: [{ didDocumentRelativeKeyId: '#auth-key', kmsKeyId: authOnlyKey.keyId }],
        })

        const credential = JsonTransformer.fromJSON(Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT, W3cCredential)

        await expect(
          w3cJsonLdCredentialService.signCredential(agentContext, {
            format: ClaimFormat.LdpVc,
            credential,
            proofType: 'Ed25519Signature2018',
            verificationMethod: authOnlyVmId,
          })
        ).rejects.toThrow(`Unable to locate verification method with id '${authOnlyVmId}' in purposes assertionMethod`)
      })
    })

    describe('verifyCredential', () => {
      it('should verify a credential successfully', async () => {
        const vc = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
          W3cJsonLdVerifiableCredential
        )
        const result = await w3cJsonLdCredentialService.verifyCredential(agentContext, { credential: vc })

        expect(result).toEqual({
          isValid: true,
          error: undefined,
          validations: {
            vcJs: {
              isValid: true,
              results: expect.any(Array),
              log: [
                {
                  id: 'valid_signature',
                  valid: true,
                },
                {
                  id: 'issuer_did_resolves',
                  valid: true,
                },
                {
                  id: 'expiration',
                  valid: true,
                },
              ],
            },
          },
        })
      })

      it('should fail because of invalid signature', async () => {
        const vc = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_BAD_SIGNED,
          W3cJsonLdVerifiableCredential
        )
        const result = await w3cJsonLdCredentialService.verifyCredential(agentContext, { credential: vc })

        expect(result).toEqual({
          isValid: false,
          error: expect.any(Error),
          validations: {
            vcJs: {
              error: expect.any(Error),
              isValid: false,
              results: expect.any(Array),
            },
          },
        })
      })

      it('should fail because of an unsigned statement', async () => {
        const vcJson = {
          ...Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
          credentialSubject: {
            ...Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED.credentialSubject,
            alumniOf: 'oops',
          },
        }

        const vc = JsonTransformer.fromJSON(vcJson, W3cJsonLdVerifiableCredential)
        const result = await w3cJsonLdCredentialService.verifyCredential(agentContext, { credential: vc })

        expect(result).toEqual({
          isValid: false,
          error: expect.any(Error),
          validations: {
            vcJs: {
              error: expect.any(Error),
              isValid: false,
              results: expect.any(Array),
            },
          },
        })
      })

      it('should fail because of a changed statement', async () => {
        const vcJson = {
          ...Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
          credentialSubject: {
            ...Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED.credentialSubject,
            degree: {
              ...Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED.credentialSubject.degree,
              name: 'oops',
            },
          },
        }

        const vc = JsonTransformer.fromJSON(vcJson, W3cJsonLdVerifiableCredential)
        const result = await w3cJsonLdCredentialService.verifyCredential(agentContext, { credential: vc })

        expect(result).toEqual({
          isValid: false,
          error: expect.any(Error),
          validations: {
            vcJs: {
              error: expect.any(Error),
              isValid: false,
              results: expect.any(Array),
            },
          },
        })
      })
    })

    describe('verifyCredential with getTrustedIssuersForVerification', () => {
      afterEach(() => {
        agentContext.config.setTrustedIssuersForVerification(undefined)
      })

      it('should accept a credential whose issuer did is trusted', async () => {
        const vc = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
          W3cJsonLdVerifiableCredential
        )
        agentContext.config.setTrustedIssuersForVerification(async () => ({
          trustedIssuers: [{ method: 'did', issuance: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL' }],
        }))

        const result = await w3cJsonLdCredentialService.verifyCredential(agentContext, { credential: vc })

        expect(result.isValid).toBe(true)
      })

      it('should reject a credential whose issuer did is not trusted', async () => {
        const vc = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
          W3cJsonLdVerifiableCredential
        )
        agentContext.config.setTrustedIssuersForVerification(async () => ({
          trustedIssuers: [{ method: 'did', issuance: 'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV' }],
        }))

        const result = await w3cJsonLdCredentialService.verifyCredential(agentContext, { credential: vc })

        expect(result.isValid).toBe(false)
        expect(result.error?.message).toContain('is not trusted')
      })
    })

    describe('signPresentation', () => {
      it('should successfully create a presentation from single verifiable credential', async () => {
        const presentation = JsonTransformer.fromJSON(Ed25519Signature2018Fixtures.TEST_VP_DOCUMENT, W3cPresentation)

        const purpose = new CredentialIssuancePurpose({
          controller: {
            id: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
          },
          date: new Date().toISOString(),
        })

        const verifiablePresentation = await w3cJsonLdCredentialService.signPresentation(agentContext, {
          format: ClaimFormat.LdpVp,
          presentation: presentation,
          proofPurpose: purpose,
          proofType: 'Ed25519Signature2018',
          challenge: '7bf32d0b-39d4-41f3-96b6-45de52988e4c',
          domain: 'issuer.example.com',
          verificationMethod: verificationMethod,
        })

        expect(verifiablePresentation).toBeInstanceOf(W3cJsonLdVerifiablePresentation)
      })
    })

    describe('verifyPresentation', () => {
      it('should successfully verify a presentation containing a single verifiable credential', async () => {
        const vp = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_VP_DOCUMENT_SIGNED,
          W3cJsonLdVerifiablePresentation
        )

        const result = await w3cJsonLdCredentialService.verifyPresentation(agentContext, {
          presentation: vp,
          challenge: '7bf32d0b-39d4-41f3-96b6-45de52988e4c',
        })

        expect(result).toEqual({
          isValid: true,
          error: undefined,
          validations: {
            vcJs: {
              isValid: true,
              presentationResult: expect.any(Object),
              credentialResults: expect.any(Array),
            },
            credentials: [
              {
                isValid: true,
                validations: { credentialSubjectAuthentication: { isValid: true } },
              },
            ],
          },
        })
      })

      it('should reject a presentation whose embedded credential issuer is not trusted', async () => {
        const vp = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_VP_DOCUMENT_SIGNED,
          W3cJsonLdVerifiablePresentation
        )

        agentContext.config.setTrustedIssuersForVerification(async () => ({
          trustedIssuers: [{ method: 'did', issuance: 'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV' }],
        }))

        const result = await w3cJsonLdCredentialService.verifyPresentation(agentContext, {
          presentation: vp,
          challenge: '7bf32d0b-39d4-41f3-96b6-45de52988e4c',
        })

        agentContext.config.setTrustedIssuersForVerification(undefined)

        expect(result.isValid).toBe(false)
        expect(result.error?.message).toContain('is not trusted')
      })

      it('should fail when presentation signature is not valid', async () => {
        const vp = JsonTransformer.fromJSON(
          {
            ...Ed25519Signature2018Fixtures.TEST_VP_DOCUMENT_SIGNED,
            proof: {
              ...Ed25519Signature2018Fixtures.TEST_VP_DOCUMENT_SIGNED.proof,
              jws: `${Ed25519Signature2018Fixtures.TEST_VP_DOCUMENT_SIGNED.proof.jws}a`,
            },
          },
          W3cJsonLdVerifiablePresentation
        )

        const result = await w3cJsonLdCredentialService.verifyPresentation(agentContext, {
          presentation: vp,
          challenge: '7bf32d0b-39d4-41f3-96b6-45de52988e4c',
        })

        expect(result).toEqual({
          isValid: false,
          error: expect.any(Error),
          validations: {
            vcJs: {
              isValid: false,
              credentialResults: expect.any(Array),
              presentationResult: expect.any(Object),
              error: expect.any(Error),
            },
            credentials: [
              {
                isValid: true,
                validations: { credentialSubjectAuthentication: { isValid: true } },
              },
            ],
          },
        })
      })

      // Signs a credential to `credentialSubjectId` (issued by issuerDidKey) and wraps it in an
      // ldp_vp that is signed (authentication proof) by issuerDidKey — the "holder". When the
      // subject differs from issuerDidKey this models an attacker presenting someone else's
      // credential under their own key. Both the issuer proof and the presentation proof are valid,
      // so only the credentialSubject authentication check can reject it.
      const signPresentationForSubject = async (credentialSubjectId: string) => {
        const credential = JsonTransformer.fromJSON(
          {
            ...Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT,
            issuer: issuerDidKey.did,
            credentialSubject: {
              id: credentialSubjectId,
              degree: {
                type: 'BachelorDegree',
                name: 'Bachelor of Science and Arts',
              },
            },
          },
          W3cCredential
        )

        const verifiableCredential = await w3cJsonLdCredentialService.signCredential(agentContext, {
          format: ClaimFormat.LdpVc,
          credential,
          proofType: 'Ed25519Signature2018',
          verificationMethod,
        })

        const presentation = JsonTransformer.fromJSON(
          {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            type: ['VerifiablePresentation'],
            holder: issuerDidKey.did,
            verifiableCredential: [verifiableCredential.toJson()],
          },
          W3cPresentation
        )

        return w3cJsonLdCredentialService.signPresentation(agentContext, {
          format: ClaimFormat.LdpVp,
          presentation,
          proofType: 'Ed25519Signature2018',
          proofPurpose: new AuthenticationProofPurpose({ challenge: 'challenge-holder-binding' }),
          challenge: 'challenge-holder-binding',
          verificationMethod,
        })
      }

      it('should fail when the presentation signer (holder) is not the credentialSubject', async () => {
        const verifiablePresentation = await signPresentationForSubject(
          'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV'
        )

        const result = await w3cJsonLdCredentialService.verifyPresentation(agentContext, {
          presentation: verifiablePresentation as W3cJsonLdVerifiablePresentation,
          challenge: 'challenge-holder-binding',
        })

        expect(result.isValid).toBe(false)
        // The library-level verification (signatures, issuer proofs) still passes; only the
        // credentialSubject authentication check that Credo adds on top rejects this presentation.
        expect(result.validations.vcJs?.isValid).toBe(true)
        expect(result.validations.credentials?.[0]).toEqual({
          isValid: false,
          validations: {
            credentialSubjectAuthentication: {
              isValid: false,
              error: expect.any(Error),
            },
          },
        })
        expect(result.error?.message).toContain('does not authenticate the credentialSubject')
      })

      it('should verify a presentation when the signer (holder) is the credentialSubject', async () => {
        const verifiablePresentation = await signPresentationForSubject(issuerDidKey.did)

        const result = await w3cJsonLdCredentialService.verifyPresentation(agentContext, {
          presentation: verifiablePresentation as W3cJsonLdVerifiablePresentation,
          challenge: 'challenge-holder-binding',
        })

        expect(result.isValid).toBe(true)
        expect(result.validations.credentials?.[0]).toEqual({
          isValid: true,
          validations: { credentialSubjectAuthentication: { isValid: true } },
        })
      })
    })

    describe('Verifiable Credentials Data Model 2.0', () => {
      const createV2Credential = (extra: Record<string, unknown> = {}) =>
        new W3cCredential({
          context: [CREDENTIALS_CONTEXT_V2_URL],
          id: 'urn:uuid:8f1f1e3a-4f52-4a5a-9d2b-8f2a0c1a1d11',
          type: ['VerifiableCredential'],
          issuer: issuerDidKey.did,
          validFrom: '2010-01-01T19:23:24Z',
          validUntil: '2030-01-01T19:23:24Z',
          credentialSubject: { id: 'did:example:ebfeb1f712ebc6f1c276e12ec21' },
          ...extra,
        })

      it('signs and verifies a credential using the data model 2.0 context', async () => {
        const vc = await w3cJsonLdCredentialService.signCredential(agentContext, {
          format: ClaimFormat.LdpVc,
          credential: createV2Credential(),
          proofType: 'Ed25519Signature2018',
          verificationMethod,
        })

        expect(vc).toBeInstanceOf(W3cJsonLdVerifiableCredential)
        expect(vc.dataModelVersion).toBe('2.0')
        expect(vc.validFrom).toBe('2010-01-01T19:23:24Z')
        expect(vc.issuanceDate).toBeUndefined()
        expect(vc.toJson()).not.toHaveProperty('issuanceDate')

        const result = await w3cJsonLdCredentialService.verifyCredential(agentContext, { credential: vc })
        expect(result.isValid).toBe(true)
      })

      it('signs and verifies a presentation using the data model 2.0 context', async () => {
        const vc = await w3cJsonLdCredentialService.signCredential(agentContext, {
          format: ClaimFormat.LdpVc,
          credential: createV2Credential({ credentialSubject: { id: issuerDidKey.did } }),
          proofType: 'Ed25519Signature2018',
          verificationMethod,
        })

        const presentation = new W3cPresentation({
          context: [CREDENTIALS_CONTEXT_V2_URL],
          holder: issuerDidKey.did,
          verifiableCredential: [vc],
        })

        const vp = await w3cJsonLdCredentialService.signPresentation(agentContext, {
          format: ClaimFormat.LdpVp,
          presentation,
          proofPurpose: new AuthenticationProofPurpose({ challenge: 'challenge-data-model-2' }),
          proofType: 'Ed25519Signature2018',
          challenge: 'challenge-data-model-2',
          verificationMethod,
        })

        expect(vp).toBeInstanceOf(W3cJsonLdVerifiablePresentation)

        const result = await w3cJsonLdCredentialService.verifyPresentation(agentContext, {
          presentation: vp as W3cJsonLdVerifiablePresentation,
          challenge: 'challenge-data-model-2',
        })

        expect(result.isValid).toBe(true)
      })

      // The data model 1.1 context defines the Ed25519Signature2020 terms, the data model 2.0 context does not.
      // Signing therefore has to add the suite context, which must resolve through the default document loader.
      it('adds the resolvable Ed25519Signature2020 suite context when signing', async () => {
        const service = new W3cJsonLdCredentialService(
          new SignatureSuiteRegistry([
            {
              suiteClass: Ed25519Signature2020,
              proofType: 'Ed25519Signature2020',
              verificationMethodTypes: [VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020],
              supportedPublicJwkTypes: [Ed25519PublicJwk],
            },
          ]),
          new W3cCredentialsModuleConfig({ documentLoader: customDocumentLoader })
        )

        const vc = await service.signCredential(agentContext, {
          format: ClaimFormat.LdpVc,
          credential: createV2Credential(),
          proofType: 'Ed25519Signature2020',
          verificationMethod,
        })

        expect(asArray(vc.proof)[0].type).toBe('Ed25519Signature2020')
        expect(vc.context).toEqual([CREDENTIALS_CONTEXT_V2_URL, 'https://w3id.org/security/suites/ed25519-2020/v1'])
        expect(DEFAULT_CONTEXTS).toHaveProperty('https://w3id.org/security/suites/ed25519-2020/v1')
      })

      it('detects a tampered credential using the data model 2.0 context', async () => {
        const vc = await w3cJsonLdCredentialService.signCredential(agentContext, {
          format: ClaimFormat.LdpVc,
          credential: createV2Credential(),
          proofType: 'Ed25519Signature2018',
          verificationMethod,
        })

        const tampered = JsonTransformer.fromJSON(
          { ...vc.toJson(), validUntil: '2040-01-01T19:23:24Z' },
          W3cJsonLdVerifiableCredential
        )

        const result = await w3cJsonLdCredentialService.verifyCredential(agentContext, { credential: tampered })
        expect(result.isValid).toBe(false)
      })
    })
  })
})
