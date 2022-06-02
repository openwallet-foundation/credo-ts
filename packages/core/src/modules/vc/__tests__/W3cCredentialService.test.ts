import type { AgentConfig } from '../../../agent/AgentConfig'

import { JsonTransformer } from '../../..'
import { getAgentConfig } from '../../../../tests/helpers'
import { KeyType } from '../../../crypto'
import { Key } from '../../../crypto/Key'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { WalletError } from '../../../wallet/error'
import { DidKey, DidResolverService } from '../../dids'
import { DidRepository } from '../../dids/repository'
import { IndyLedgerService } from '../../ledger/services/IndyLedgerService'
import { W3cCredentialService } from '../W3cCredentialService'
import { orArrayToArray } from '../jsonldUtil'
import { purposes } from '../libraries/jsonld-signatures'
import { W3cCredential, W3cVerifiableCredential } from '../models'
import { LinkedDataProof } from '../models/LinkedDataProof'
import { W3cCredentialRepository } from '../models/credential/W3cCredentialRepository'
import { W3cPresentation } from '../models/presentation/W3Presentation'
import { W3cVerifiablePresentation } from '../models/presentation/W3cVerifiablePresentation'
import { CredentialIssuancePurpose } from '../proof-purposes/CredentialIssuancePurpose'

import { customDocumentLoader } from './documentLoader'
import { BbsBlsSignature2020Fixtures, Ed25519Signature2018Fixtures } from './fixtures'

jest.mock('../../ledger/services/IndyLedgerService')

const IndyLedgerServiceMock = IndyLedgerService as jest.Mock<IndyLedgerService>
const DidRepositoryMock = DidRepository as unknown as jest.Mock<DidRepository>

jest.mock('../models/credential/W3cCredentialRepository')
const W3cCredentialRepositoryMock = W3cCredentialRepository as jest.Mock<W3cCredentialRepository>

describe('W3cCredentialService', () => {
  let wallet: IndyWallet
  let agentConfig: AgentConfig
  let didResolverService: DidResolverService
  let w3cCredentialService: W3cCredentialService
  let w3cCredentialRepository: W3cCredentialRepository
  const seed = 'testseed000000000000000000000001'

  beforeAll(async () => {
    agentConfig = getAgentConfig('W3cCredentialServiceTest')
    wallet = new IndyWallet(agentConfig)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(agentConfig.walletConfig!)
    didResolverService = new DidResolverService(agentConfig, new IndyLedgerServiceMock(), new DidRepositoryMock())
    w3cCredentialRepository = new W3cCredentialRepositoryMock()
    w3cCredentialService = new W3cCredentialService(wallet, w3cCredentialRepository, didResolverService)
    w3cCredentialService.documentLoader = customDocumentLoader
  })

  afterAll(async () => {
    await wallet.delete()
  })

  describe('Ed25519Signature2018', () => {
    let issuerDidKey: DidKey
    let verificationMethod: string
    beforeAll(async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const issuerDidInfo = await wallet.createDid({ seed })
      const issuerKey = Key.fromPublicKeyBase58(issuerDidInfo.verkey, KeyType.Ed25519)
      issuerDidKey = new DidKey(issuerKey)
      verificationMethod = `${issuerDidKey.did}#${issuerDidKey.key.fingerprint}`
    })
    describe('signCredential', () => {
      it('should return a successfully signed credential', async () => {
        const credentialJson = Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT

        const credential = JsonTransformer.fromJSON(credentialJson, W3cCredential)

        const vc = await w3cCredentialService.signCredential({
          credential,
          proofType: 'Ed25519Signature2018',
          verificationMethod: verificationMethod,
        })

        expect(vc).toBeInstanceOf(W3cVerifiableCredential)
        expect(vc.issuer).toEqual(issuerDidKey.did)
        expect(Array.isArray(vc.proof)).toBe(false)
        expect(vc.proof).toBeInstanceOf(LinkedDataProof)

        // @ts-ignore
        expect(vc.proof.verificationMethod).toEqual(verificationMethod)
      })

      it('should throw because of verificationMethod does not belong to this wallet', async () => {
        const credentialJson = Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT
        credentialJson.issuer = issuerDidKey.did

        const credential = JsonTransformer.fromJSON(credentialJson, W3cCredential)

        expect(async () => {
          await w3cCredentialService.signCredential({
            credential,
            proofType: 'Ed25519Signature2018',
            verificationMethod:
              'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV#z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV',
          })
        }).rejects.toThrowError(WalletError)
      })
    })
    describe('verifyCredential', () => {
      it('should credential verify successfully', async () => {
        const vc = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
          W3cVerifiableCredential
        )
        const result = await w3cCredentialService.verifyCredential({ credential: vc })

        expect(result.verified).toBe(true)
        expect(result.error).toBeUndefined()

        expect(result.results.length).toBe(1)

        expect(result.results[0].verified).toBe(true)
        expect(result.results[0].error).toBeUndefined()
      })
      it('should fail because of invalid signature', async () => {
        const vc = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_BAD_SIGNED,
          W3cVerifiableCredential
        )
        const result = await w3cCredentialService.verifyCredential({ credential: vc })

        expect(result.verified).toBe(false)
        expect(result.error).toBeDefined()

        // @ts-ignore
        expect(result.error.errors[0]).toBeInstanceOf(Error)
        // @ts-ignore
        expect(result.error.errors[0].message).toBe('Invalid signature.')
      })
      it('should fail because of an unsigned statement', async () => {
        const vcJson = {
          ...Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
          credentialSubject: {
            ...Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED.credentialSubject,
            alumniOf: 'oops',
          },
        }

        const vc = JsonTransformer.fromJSON(vcJson, W3cVerifiableCredential)
        const result = await w3cCredentialService.verifyCredential({ credential: vc })

        expect(result.verified).toBe(false)

        // @ts-ignore
        expect(result.error.errors[0]).toBeInstanceOf(Error)
        // @ts-ignore
        expect(result.error.errors[0].message).toBe('Invalid signature.')
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

        const vc = JsonTransformer.fromJSON(vcJson, W3cVerifiableCredential)
        const result = await w3cCredentialService.verifyCredential({ credential: vc })

        expect(result.verified).toBe(false)

        // @ts-ignore
        expect(result.error.errors[0]).toBeInstanceOf(Error)
        // @ts-ignore
        expect(result.error.errors[0].message).toBe('Invalid signature.')
      })
    })
    describe('createPresentation', () => {
      it('should successfully create a presentation from single verifiable credential', async () => {
        const vc = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
          W3cVerifiableCredential
        )
        const result = await w3cCredentialService.createPresentation({ credentials: vc })

        expect(result).toBeInstanceOf(W3cPresentation)

        expect(result.type).toEqual(expect.arrayContaining(['VerifiablePresentation']))

        expect(result.verifiableCredential).toHaveLength(1)
        expect(result.verifiableCredential).toEqual(expect.arrayContaining([vc]))
      })
      it('should successfully create a presentation from two verifiable credential', async () => {
        const vc1 = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
          W3cVerifiableCredential
        )
        const vc2 = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
          W3cVerifiableCredential
        )

        const vcs = [vc1, vc2]
        const result = await w3cCredentialService.createPresentation({ credentials: vcs })

        expect(result).toBeInstanceOf(W3cPresentation)

        expect(result.type).toEqual(expect.arrayContaining(['VerifiablePresentation']))

        expect(result.verifiableCredential).toHaveLength(2)
        expect(result.verifiableCredential).toEqual(expect.arrayContaining([vc1, vc2]))
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

        const verifiablePresentation = await w3cCredentialService.signPresentation({
          presentation: presentation,
          purpose: purpose,
          signatureType: 'Ed25519Signature2018',
          challenge: '7bf32d0b-39d4-41f3-96b6-45de52988e4c',
          verificationMethod: verificationMethod,
        })

        expect(verifiablePresentation).toBeInstanceOf(W3cVerifiablePresentation)
      })
    })
    describe('verifyPresentation', () => {
      it('should successfully verify a presentation containing a single verifiable credential', async () => {
        const vp = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_VP_DOCUMENT_SIGNED,
          W3cVerifiablePresentation
        )

        const result = await w3cCredentialService.verifyPresentation({
          presentation: vp,
          proofType: 'Ed25519Signature2018',
          challenge: '7bf32d0b-39d4-41f3-96b6-45de52988e4c',
          verificationMethod:
            'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
        })

        expect(result.verified).toBe(true)
      })
    })
    describe('storeCredential', () => {
      it('should store a credential', async () => {
        const credential = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
          W3cVerifiableCredential
        )

        const w3cCredentialRecord = await w3cCredentialService.storeCredential({ record: credential })
        expect(w3cCredentialRecord).toMatchObject({
          type: 'W3cCredentialRecord',
          id: expect.any(String),
          createdAt: expect.any(Date),
          credential: expect.any(W3cVerifiableCredential),
        })

        expect(w3cCredentialRecord.getTags()).toMatchObject({
          expandedTypes: [
            'https://www.w3.org/2018/credentials#VerifiableCredential',
            'https://example.org/examples#UniversityDegreeCredential',
          ],
        })
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

        const vc = await w3cCredentialService.signCredential({
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
        const result = await w3cCredentialService.verifyCredential({
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

        const result = await w3cCredentialService.deriveProof({
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
        const result = await w3cCredentialService.verifyCredential({
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

        const verifiablePresentation = await w3cCredentialService.signPresentation({
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

        const result = await w3cCredentialService.verifyPresentation({
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
