import type { AgentContext } from '../../../../agent'
import type { Wallet } from '../../../../wallet'

import { InMemoryWallet } from '../../../../../../../tests/InMemoryWallet'
import { getAgentConfig, getAgentContext } from '../../../../../tests/helpers'
import { KeyType } from '../../../../crypto'
import { TypedArrayEncoder, asArray } from '../../../../utils'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { WalletError } from '../../../../wallet/error'
import {
  DidKey,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
} from '../../../dids'
import { W3cCredentialsModuleConfig } from '../../W3cCredentialsModuleConfig'
import { ClaimFormat, W3cCredential } from '../../models'
import { W3cPresentation } from '../../models/presentation/W3cPresentation'
import { SignatureSuiteRegistry } from '../SignatureSuiteRegistry'
import { W3cJsonLdCredentialService } from '../W3cJsonLdCredentialService'
import { W3cJsonLdVerifiableCredential } from '../models'
import { LinkedDataProof } from '../models/LinkedDataProof'
import { W3cJsonLdVerifiablePresentation } from '../models/W3cJsonLdVerifiablePresentation'
import { CredentialIssuancePurpose } from '../proof-purposes/CredentialIssuancePurpose'
import { Ed25519Signature2018 } from '../signature-suites'

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
    keyTypes: [KeyType.Ed25519],
  },
])

const agentConfig = getAgentConfig('W3cJsonLdCredentialServiceTest')

describe('W3cJsonLdCredentialsService', () => {
  let wallet: Wallet
  let agentContext: AgentContext
  let w3cJsonLdCredentialService: W3cJsonLdCredentialService
  const privateKey = TypedArrayEncoder.fromString('testseed000000000000000000000001')

  beforeAll(async () => {
    wallet = new InMemoryWallet()
    await wallet.createAndOpen(agentConfig.walletConfig)
    agentContext = getAgentContext({
      agentConfig,
      wallet,
    })
    w3cJsonLdCredentialService = new W3cJsonLdCredentialService(
      signatureSuiteRegistry,
      new W3cCredentialsModuleConfig({
        documentLoader: customDocumentLoader,
      })
    )
  })

  afterAll(async () => {
    await wallet.delete()
  })

  describe('Utility methods', () => {
    describe('getKeyTypesByProofType', () => {
      it('should return the correct key types for Ed25519Signature2018 proof type', async () => {
        const keyTypes = w3cJsonLdCredentialService.getKeyTypesByProofType('Ed25519Signature2018')
        expect(keyTypes).toEqual([KeyType.Ed25519])
      })
    })

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
      // TODO: update to use did registrar
      const issuerKey = await wallet.createKey({
        keyType: KeyType.Ed25519,
        privateKey,
      })
      issuerDidKey = new DidKey(issuerKey)
      verificationMethod = `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`
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

        expect(async () => {
          await w3cJsonLdCredentialService.signCredential(agentContext, {
            format: ClaimFormat.LdpVc,
            credential,
            proofType: 'Ed25519Signature2018',
            verificationMethod:
              'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV#z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV',
          })
        }).rejects.toThrowError(WalletError)
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
                  id: 'expiration',
                  valid: true,
                },
                {
                  id: 'valid_signature',
                  valid: true,
                },
                {
                  id: 'issuer_did_resolves',
                  valid: true,
                },
                {
                  id: 'revocation_status',
                  valid: true,
                },
              ],
              statusResult: {
                verified: true,
              },
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
