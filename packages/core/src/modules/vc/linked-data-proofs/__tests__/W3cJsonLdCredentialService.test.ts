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
import { ClaimFormat, W3cCredential } from '../../models'
import { W3cPresentation } from '../../models/presentation/W3cPresentation'
import { W3cCredentialsModuleConfig } from '../../W3cCredentialsModuleConfig'
import { LinkedDataProof } from '../models/LinkedDataProof'
import { W3cJsonLdVerifiableCredential } from '../models/W3cJsonLdVerifiableCredential'
import { W3cJsonLdVerifiablePresentation } from '../models/W3cJsonLdVerifiablePresentation'
import { CredentialIssuancePurpose } from '../proof-purposes/CredentialIssuancePurpose'
import { SignatureSuiteRegistry } from '../SignatureSuiteRegistry'
import { Ed25519Signature2018 } from '../signature-suites'
import { W3cJsonLdCredentialService } from '../W3cJsonLdCredentialService'
import { customDocumentLoader } from './documentLoader'
import { Ed25519Signature2018Fixtures } from './fixtures'

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
          },
        })
      })
    })
  })
})
