import { KeyType, JsonTransformer, AgentContext, DidResolverService, DidKey, Key } from '@aries-framework/core'
import {
  SigningProviderRegistry,
  W3cVerifiableCredential,
  W3cCredentialService,
  W3cCredential,
  CredentialIssuancePurpose,
} from '@aries-framework/core'
import { VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020 } from '@aries-framework/core'
import { orArrayToArray } from '@aries-framework/core'
import { purposes } from '@aries-framework/core/src/modules/vc/libraries/jsonld-signatures'
import { LinkedDataProof } from '@aries-framework/core/src/modules/vc/models/LinkedDataProof'
import { W3cVerifiablePresentation } from '@aries-framework/core/src/modules/vc/models/presentation/W3cVerifiablePresentation'
import { W3cPresentation } from '@aries-framework/core/src/modules/vc/models/presentation/W3cPresentation'
import { W3cCredentialRepository } from '@aries-framework/core/src/modules/vc/repository'
import { SignatureSuiteRegistry } from '@aries-framework/core/src/modules/vc/SignatureSuiteRegistry'
import { getAgentConfig, getAgentContext } from '@aries-framework/core/tests/helpers'
import { customDocumentLoader } from '@aries-framework/core/src/modules/vc/__tests__/documentLoader'
import { IndyWallet } from '@aries-framework/core/src/wallet/IndyWallet'
import { BbsBlsSignature2020, BbsBlsSignatureProof2020, Bls12381g2SigningProvider } from '../src'
import { BbsBlsSignature2020Fixtures } from './fixtures'

const signatureSuiteRegistry = new SignatureSuiteRegistry([
  {
    suiteClass: BbsBlsSignature2020,
    proofType: 'BbsBlsSignature2020',
    verificationMethodTypes: [VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020],
    keyTypes: [KeyType.Bls12381g2],
  },
  {
    suiteClass: BbsBlsSignatureProof2020,
    proofType: 'BbsBlsSignatureProof2020',
    verificationMethodTypes: [VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020],
    keyTypes: [KeyType.Bls12381g2],
  },
])

const signingProviderRegistry = new SigningProviderRegistry([new Bls12381g2SigningProvider()])

jest.mock('../../ledger/services/IndyLedgerService')

jest.mock('../repository/W3cCredentialRepository')
const W3cCredentialRepositoryMock = W3cCredentialRepository as jest.Mock<W3cCredentialRepository>

const agentConfig = getAgentConfig('W3cCredentialServiceTest')

describe('BBS W3cCredentialService', () => {
  let wallet: IndyWallet
  let agentContext: AgentContext
  let didResolverService: DidResolverService
  let w3cCredentialService: W3cCredentialService
  let w3cCredentialRepository: W3cCredentialRepository
  const seed = 'testseed000000000000000000000001'

  beforeAll(async () => {
    wallet = new IndyWallet(agentConfig.agentDependencies, agentConfig.logger, signingProviderRegistry)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(agentConfig.walletConfig!)
    agentContext = getAgentContext({
      agentConfig,
      wallet,
    })
    didResolverService = new DidResolverService(agentConfig.logger, [])
    w3cCredentialRepository = new W3cCredentialRepositoryMock()
    w3cCredentialService = new W3cCredentialService(w3cCredentialRepository, didResolverService, signatureSuiteRegistry)
    w3cCredentialService.documentLoaderWithContext = () => customDocumentLoader
  })

  afterAll(async () => {
    await wallet.delete()
  })

  describe('Utility methods', () => {
    describe('getKeyTypesByProofType', () => {
      it('should return the correct key types for BbsBlsSignature2020 proof type', async () => {
        const keyTypes = w3cCredentialService.getKeyTypesByProofType('BbsBlsSignature2020')
        expect(keyTypes).toEqual([KeyType.Bls12381g2])
      })
      it('should return the correct key types for BbsBlsSignatureProof2020 proof type', async () => {
        const keyTypes = w3cCredentialService.getKeyTypesByProofType('BbsBlsSignatureProof2020')
        expect(keyTypes).toEqual([KeyType.Bls12381g2])
      })
    })

    describe('getVerificationMethodTypesByProofType', () => {
      it('should return the correct key types for BbsBlsSignature2020 proof type', async () => {
        const verificationMethodTypes =
          w3cCredentialService.getVerificationMethodTypesByProofType('BbsBlsSignature2020')
        expect(verificationMethodTypes).toEqual([VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020])
      })
      it('should return the correct key types for BbsBlsSignatureProof2020 proof type', async () => {
        const verificationMethodTypes =
          w3cCredentialService.getVerificationMethodTypesByProofType('BbsBlsSignatureProof2020')
        expect(verificationMethodTypes).toEqual([VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020])
      })
    })
  })

  describe('BbsBlsSignature2020', () => {
    let issuerDidKey: DidKey
    let verificationMethod: string

    beforeAll(async () => {
      const key = await wallet.createKey({ keyType: KeyType.Bls12381g2, seed })
      issuerDidKey = new DidKey(key)
      verificationMethod = `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`
    })

    describe('signCredential', () => {
      it('should return a successfully signed credential bbs', async () => {
        const credentialJson = BbsBlsSignature2020Fixtures.TEST_LD_DOCUMENT
        credentialJson.issuer = issuerDidKey.did

        const credential = JsonTransformer.fromJSON(credentialJson, W3cCredential)

        const vc = await w3cCredentialService.signCredential(agentContext, {
          credential,
          proofType: 'BbsBlsSignature2020',
          verificationMethod: verificationMethod,
        })

        expect(vc).toBeInstanceOf(W3cVerifiableCredential)
        expect(vc.issuer).toEqual(issuerDidKey.did)
        expect(Array.isArray(vc.proof)).toBe(false)
        expect(vc.proof).toBeInstanceOf(LinkedDataProof)

        vc.proof = vc.proof as LinkedDataProof
        expect(vc.proof.verificationMethod).toEqual(verificationMethod)
      })
    })

    describe('verifyCredential', () => {
      it('should verify the credential successfully', async () => {
        const result = await w3cCredentialService.verifyCredential(agentContext, {
          credential: JsonTransformer.fromJSON(
            BbsBlsSignature2020Fixtures.TEST_LD_DOCUMENT_SIGNED,
            W3cVerifiableCredential
          ),
          proofPurpose: new purposes.AssertionProofPurpose(),
        })

        expect(result.verified).toEqual(true)
      })
    })

    describe('deriveProof', () => {
      it('should derive proof successfully', async () => {
        const credentialJson = BbsBlsSignature2020Fixtures.TEST_LD_DOCUMENT_SIGNED

        const vc = JsonTransformer.fromJSON(credentialJson, W3cVerifiableCredential)

        const revealDocument = {
          '@context': [
            'https://www.w3.org/2018/credentials/v1',
            'https://w3id.org/citizenship/v1',
            'https://w3id.org/security/bbs/v1',
          ],
          type: ['VerifiableCredential', 'PermanentResidentCard'],
          credentialSubject: {
            '@explicit': true,
            type: ['PermanentResident', 'Person'],
            givenName: {},
            familyName: {},
            gender: {},
          },
        }

        const result = await w3cCredentialService.deriveProof(agentContext, {
          credential: vc,
          revealDocument: revealDocument,
          verificationMethod: verificationMethod,
        })

        // result.proof = result.proof as LinkedDataProof
        expect(orArrayToArray(result.proof)[0].verificationMethod).toBe(
          'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN#zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN'
        )
      })
    })

    describe('verifyDerived', () => {
      it('should verify the derived proof successfully', async () => {
        const result = await w3cCredentialService.verifyCredential(agentContext, {
          credential: JsonTransformer.fromJSON(BbsBlsSignature2020Fixtures.TEST_VALID_DERIVED, W3cVerifiableCredential),
          proofPurpose: new purposes.AssertionProofPurpose(),
        })
        expect(result.verified).toEqual(true)
      })
    })

    describe('createPresentation', () => {
      it('should create a presentation successfully', async () => {
        const vc = JsonTransformer.fromJSON(BbsBlsSignature2020Fixtures.TEST_VALID_DERIVED, W3cVerifiableCredential)
        const result = await w3cCredentialService.createPresentation({ credentials: vc })

        expect(result).toBeInstanceOf(W3cPresentation)

        expect(result.type).toEqual(expect.arrayContaining(['VerifiablePresentation']))

        expect(result.verifiableCredential).toHaveLength(1)
        expect(result.verifiableCredential).toEqual(expect.arrayContaining([vc]))
      })
    })

    describe('signPresentation', () => {
      it('should sign the presentation successfully', async () => {
        const signingKey = Key.fromPublicKeyBase58((await wallet.createDid({ seed })).verkey, KeyType.Ed25519)
        const signingDidKey = new DidKey(signingKey)
        const verificationMethod = `${signingDidKey.did}#${signingDidKey.key.fingerprint}`
        const presentation = JsonTransformer.fromJSON(BbsBlsSignature2020Fixtures.TEST_VP_DOCUMENT, W3cPresentation)

        const purpose = new CredentialIssuancePurpose({
          controller: {
            id: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
          },
          date: new Date().toISOString(),
        })

        const verifiablePresentation = await w3cCredentialService.signPresentation(agentContext, {
          presentation: presentation,
          purpose: purpose,
          signatureType: 'Ed25519Signature2018',
          challenge: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
          verificationMethod: verificationMethod,
        })

        expect(verifiablePresentation).toBeInstanceOf(W3cVerifiablePresentation)
      })
    })

    describe('verifyPresentation', () => {
      it('should successfully verify a presentation containing a single verifiable credential bbs', async () => {
        const vp = JsonTransformer.fromJSON(
          BbsBlsSignature2020Fixtures.TEST_VP_DOCUMENT_SIGNED,
          W3cVerifiablePresentation
        )

        const result = await w3cCredentialService.verifyPresentation(agentContext, {
          presentation: vp,
          proofType: 'Ed25519Signature2018',
          challenge: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
          verificationMethod:
            'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
        })

        expect(result.verified).toBe(true)
      })
    })
  })
})
