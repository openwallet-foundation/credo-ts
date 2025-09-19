import type { W3cCredentialRepository } from '../../core/src/modules/vc/repository/W3cCredentialRepository'
import type { AgentContext, W3cJwtCredentialService, Wallet } from '@credo-ts/core'

import {
  ClaimFormat,
  W3cCredentialService,
  W3cJsonLdVerifiablePresentation,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
  KeyType,
  JsonTransformer,
  DidKey,
  SigningProviderRegistry,
  W3cCredential,
  CredentialIssuancePurpose,
  VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020,
  vcLibraries,
  W3cPresentation,
  Ed25519Signature2018,
  TypedArrayEncoder,
  W3cJsonLdVerifiableCredential,
} from '@credo-ts/core'

import { AskarModuleConfig } from '../../askar/src/AskarModuleConfig'
import { ariesAskar, RegisteredAskarTestWallet } from '../../askar/tests/helpers'
import { W3cCredentialsModuleConfig } from '../../core/src/modules/vc/W3cCredentialsModuleConfig'
import { SignatureSuiteRegistry } from '../../core/src/modules/vc/data-integrity/SignatureSuiteRegistry'
import { W3cJsonLdCredentialService } from '../../core/src/modules/vc/data-integrity/W3cJsonLdCredentialService'
import { customDocumentLoader } from '../../core/src/modules/vc/data-integrity/__tests__/documentLoader'
import { LinkedDataProof } from '../../core/src/modules/vc/data-integrity/models/LinkedDataProof'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../core/tests/helpers'
import { BbsBlsSignature2020, BbsBlsSignatureProof2020, Bls12381g2SigningProvider } from '../src'

import { BbsBlsSignature2020Fixtures } from './fixtures'
import { describeSkipNode18 } from './util'

const { jsonldSignatures } = vcLibraries
const { purposes } = jsonldSignatures

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
  {
    suiteClass: Ed25519Signature2018,
    proofType: 'Ed25519Signature2018',
    verificationMethodTypes: [VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018],
    keyTypes: [KeyType.Ed25519],
  },
])

const signingProviderRegistry = new SigningProviderRegistry([new Bls12381g2SigningProvider()])

const agentConfig = getAgentConfig('BbsSignaturesE2eTest')

describeSkipNode18('BBS W3cCredentialService', () => {
  let wallet: Wallet
  let agentContext: AgentContext
  let w3cJsonLdCredentialService: W3cJsonLdCredentialService
  let w3cCredentialService: W3cCredentialService
  const privateKey = TypedArrayEncoder.fromString('testseed000000000000000000000001')

  beforeAll(async () => {
    // Use askar wallet so we can use the signing provider registry
    // TODO: support signing provider registry in memory wallet
    // so we don't have to use askar here
    wallet = new RegisteredAskarTestWallet(
      agentConfig.logger,
      new agentDependencies.FileSystem(),
      signingProviderRegistry,
      new AskarModuleConfig({ ariesAskar })
    )
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
    w3cCredentialService = new W3cCredentialService(
      {} as unknown as W3cCredentialRepository,
      w3cJsonLdCredentialService,
      {} as unknown as W3cJwtCredentialService
    )
  })

  afterAll(async () => {
    await wallet.delete()
  })

  describe('Utility methods', () => {
    describe('getKeyTypesByProofType', () => {
      it('should return the correct key types for BbsBlsSignature2020 proof type', async () => {
        const keyTypes = w3cJsonLdCredentialService.getKeyTypesByProofType('BbsBlsSignature2020')
        expect(keyTypes).toEqual([KeyType.Bls12381g2])
      })
      it('should return the correct key types for BbsBlsSignatureProof2020 proof type', async () => {
        const keyTypes = w3cJsonLdCredentialService.getKeyTypesByProofType('BbsBlsSignatureProof2020')
        expect(keyTypes).toEqual([KeyType.Bls12381g2])
      })
    })

    describe('getVerificationMethodTypesByProofType', () => {
      it('should return the correct key types for BbsBlsSignature2020 proof type', async () => {
        const verificationMethodTypes =
          w3cJsonLdCredentialService.getVerificationMethodTypesByProofType('BbsBlsSignature2020')
        expect(verificationMethodTypes).toEqual([VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020])
      })
      it('should return the correct key types for BbsBlsSignatureProof2020 proof type', async () => {
        const verificationMethodTypes =
          w3cJsonLdCredentialService.getVerificationMethodTypesByProofType('BbsBlsSignatureProof2020')
        expect(verificationMethodTypes).toEqual([VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020])
      })
    })
  })

  describe('BbsBlsSignature2020', () => {
    let issuerDidKey: DidKey
    let verificationMethod: string

    beforeAll(async () => {
      // FIXME: askar doesn't create the same privateKey based on the same seed as when generated used askar BBS library...
      // See https://github.com/hyperledger/aries-askar/issues/219
      const key = await wallet.createKey({
        keyType: KeyType.Bls12381g2,
        privateKey: TypedArrayEncoder.fromBase58('2szQ7zB4tKLJPsGK3YTp9SNQ6hoWYFG5rGhmgfQM4nb7'),
      })

      issuerDidKey = new DidKey(key)
      verificationMethod = `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`
    })

    describe('signCredential', () => {
      it('should return a successfully signed credential bbs', async () => {
        const credentialJson = BbsBlsSignature2020Fixtures.TEST_LD_DOCUMENT
        credentialJson.issuer = issuerDidKey.did

        const credential = JsonTransformer.fromJSON(credentialJson, W3cCredential)

        const vc = await w3cJsonLdCredentialService.signCredential(agentContext, {
          format: ClaimFormat.LdpVc,
          credential,
          proofType: 'BbsBlsSignature2020',
          verificationMethod,
        })

        expect(vc).toBeInstanceOf(W3cJsonLdVerifiableCredential)
        expect(vc.issuer).toEqual(issuerDidKey.did)
        expect(Array.isArray(vc.proof)).toBe(false)
        expect(vc.proof).toBeInstanceOf(LinkedDataProof)

        vc.proof = vc.proof as LinkedDataProof
        expect(vc.proof.verificationMethod).toEqual(verificationMethod)
      })
    })

    describe('verifyCredential', () => {
      it('should verify the credential successfully', async () => {
        const result = await w3cJsonLdCredentialService.verifyCredential(agentContext, {
          credential: JsonTransformer.fromJSON(
            BbsBlsSignature2020Fixtures.TEST_LD_DOCUMENT_SIGNED,
            W3cJsonLdVerifiableCredential
          ),
          proofPurpose: new purposes.AssertionProofPurpose(),
        })

        expect(result.isValid).toEqual(true)
      })
    })

    describe('deriveProof', () => {
      it('should derive proof successfully', async () => {
        const credentialJson = BbsBlsSignature2020Fixtures.TEST_LD_DOCUMENT_SIGNED

        const vc = JsonTransformer.fromJSON(credentialJson, W3cJsonLdVerifiableCredential)

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

        const result = await w3cJsonLdCredentialService.deriveProof(agentContext, {
          credential: vc,
          revealDocument: revealDocument,
          verificationMethod: verificationMethod,
        })

        result.proof = result.proof as LinkedDataProof
        expect(result.proof.verificationMethod).toBe(
          'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN#zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN'
        )
      })
    })

    describe('verifyDerived', () => {
      it('should verify the derived proof successfully', async () => {
        const result = await w3cJsonLdCredentialService.verifyCredential(agentContext, {
          credential: JsonTransformer.fromJSON(
            BbsBlsSignature2020Fixtures.TEST_VALID_DERIVED,
            W3cJsonLdVerifiableCredential
          ),
          proofPurpose: new purposes.AssertionProofPurpose(),
        })
        expect(result.isValid).toEqual(true)
      })
    })

    describe('createPresentation', () => {
      it('should create a presentation successfully', async () => {
        const vc = JsonTransformer.fromJSON(
          BbsBlsSignature2020Fixtures.TEST_VALID_DERIVED,
          W3cJsonLdVerifiableCredential
        )
        const result = await w3cCredentialService.createPresentation({ credentials: [vc] })

        expect(result).toBeInstanceOf(W3cPresentation)

        expect(result.type).toEqual(expect.arrayContaining(['VerifiablePresentation']))

        expect(result.verifiableCredential).toHaveLength(1)
        expect(result.verifiableCredential).toEqual(expect.arrayContaining([vc]))
      })
    })

    describe('signPresentation', () => {
      it('should sign the presentation successfully', async () => {
        const signingKey = await wallet.createKey({
          privateKey,
          keyType: KeyType.Ed25519,
        })
        const signingDidKey = new DidKey(signingKey)
        const verificationMethod = `${signingDidKey.did}#${signingDidKey.key.fingerprint}`
        const presentation = JsonTransformer.fromJSON(BbsBlsSignature2020Fixtures.TEST_VP_DOCUMENT, W3cPresentation)

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
          challenge: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
          verificationMethod: verificationMethod,
        })

        expect(verifiablePresentation).toBeInstanceOf(W3cJsonLdVerifiablePresentation)
      })
    })

    describe('verifyPresentation', () => {
      it('should successfully verify a presentation containing a single verifiable credential bbs', async () => {
        const vp = JsonTransformer.fromJSON(
          BbsBlsSignature2020Fixtures.TEST_VP_DOCUMENT_SIGNED,
          W3cJsonLdVerifiablePresentation
        )

        const result = await w3cJsonLdCredentialService.verifyPresentation(agentContext, {
          presentation: vp,
          challenge: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
        })

        expect(result.isValid).toBe(true)
      })
    })
  })
})
