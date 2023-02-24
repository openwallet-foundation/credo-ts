import type { AgentContext } from '../../../agent'
import type { Wallet } from '../../../wallet'

import { IndySdkWallet } from '../../../../../indy-sdk/src'
import { indySdk } from '../../../../../indy-sdk/tests/setupIndySdkModule'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../tests/helpers'
import { KeyType } from '../../../crypto'
import { SigningProviderRegistry } from '../../../crypto/signing-provider'
import { TypedArrayEncoder } from '../../../utils'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { WalletError } from '../../../wallet/error'
import { DidKey } from '../../dids'
import {
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
} from '../../dids/domain/key-type/ed25519'
import { SignatureSuiteRegistry } from '../SignatureSuiteRegistry'
import { W3cCredentialService } from '../W3cCredentialService'
import { W3cVcModuleConfig } from '../W3cVcModuleConfig'
import { orArrayToArray } from '../jsonldUtil'
import jsonld from '../libraries/jsonld'
import { W3cCredential, W3cVerifiableCredential } from '../models'
import { LinkedDataProof } from '../models/LinkedDataProof'
import { W3cPresentation } from '../models/presentation/W3cPresentation'
import { W3cVerifiablePresentation } from '../models/presentation/W3cVerifiablePresentation'
import { CredentialIssuancePurpose } from '../proof-purposes/CredentialIssuancePurpose'
import { W3cCredentialRecord, W3cCredentialRepository } from '../repository'
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

const signingProviderRegistry = new SigningProviderRegistry([])

jest.mock('../repository/W3cCredentialRepository')
const W3cCredentialRepositoryMock = W3cCredentialRepository as jest.Mock<W3cCredentialRepository>

const agentConfig = getAgentConfig('W3cCredentialServiceTest')

// Helper func
const credentialRecordFactory = async (credential: W3cVerifiableCredential) => {
  const expandedTypes = (
    await jsonld.expand(JsonTransformer.toJSON(credential), { documentLoader: customDocumentLoader() })
  )[0]['@type']

  // Create an instance of the w3cCredentialRecord
  return new W3cCredentialRecord({
    tags: { expandedTypes: orArrayToArray<string>(expandedTypes) },
    credential: credential,
  })
}

describe('W3cCredentialService', () => {
  let wallet: Wallet
  let agentContext: AgentContext
  let w3cCredentialService: W3cCredentialService
  let w3cCredentialRepository: W3cCredentialRepository
  const privateKey = TypedArrayEncoder.fromString('testseed000000000000000000000001')

  beforeAll(async () => {
    wallet = new IndySdkWallet(indySdk, agentConfig.logger, signingProviderRegistry)
    await wallet.createAndOpen(agentConfig.walletConfig)
    agentContext = getAgentContext({
      agentConfig,
      wallet,
    })
    w3cCredentialRepository = new W3cCredentialRepositoryMock()
    w3cCredentialService = new W3cCredentialService(
      w3cCredentialRepository,
      signatureSuiteRegistry,
      new W3cVcModuleConfig({
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
        const keyTypes = w3cCredentialService.getKeyTypesByProofType('Ed25519Signature2018')
        expect(keyTypes).toEqual([KeyType.Ed25519])
      })
    })

    describe('getVerificationMethodTypesByProofType', () => {
      it('should return the correct key types for Ed25519Signature2018 proof type', async () => {
        const verificationMethodTypes =
          w3cCredentialService.getVerificationMethodTypesByProofType('Ed25519Signature2018')
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

        const vc = await w3cCredentialService.signCredential(agentContext, {
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
          await w3cCredentialService.signCredential(agentContext, {
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
        const result = await w3cCredentialService.verifyCredential(agentContext, { credential: vc })

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
        const result = await w3cCredentialService.verifyCredential(agentContext, { credential: vc })

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
        const result = await w3cCredentialService.verifyCredential(agentContext, { credential: vc })

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
        const result = await w3cCredentialService.verifyCredential(agentContext, { credential: vc })

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

        const verifiablePresentation = await w3cCredentialService.signPresentation(agentContext, {
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

        const result = await w3cCredentialService.verifyPresentation(agentContext, {
          presentation: vp,
          challenge: '7bf32d0b-39d4-41f3-96b6-45de52988e4c',
        })

        expect(result.verified).toBe(true)
      })
    })
  })

  describe('Credential Storage', () => {
    let w3cCredentialRecord: W3cCredentialRecord
    let w3cCredentialRepositoryDeleteMock: jest.MockedFunction<(typeof w3cCredentialRepository)['delete']>

    beforeEach(async () => {
      const credential = JsonTransformer.fromJSON(
        Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
        W3cVerifiableCredential
      )

      w3cCredentialRecord = await credentialRecordFactory(credential)

      mockFunction(w3cCredentialRepository.getById).mockResolvedValue(w3cCredentialRecord)
      mockFunction(w3cCredentialRepository.getAll).mockResolvedValue([w3cCredentialRecord])
      w3cCredentialRepositoryDeleteMock = mockFunction(w3cCredentialRepository.delete).mockResolvedValue()
    })
    describe('storeCredential', () => {
      it('should store a credential and expand the tags correctly', async () => {
        const credential = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
          W3cVerifiableCredential
        )

        w3cCredentialRecord = await w3cCredentialService.storeCredential(agentContext, { credential: credential })

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

    describe('removeCredentialRecord', () => {
      it('should remove a credential', async () => {
        const credential = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
          W3cVerifiableCredential
        )

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await w3cCredentialService.removeCredentialRecord(agentContext, credential.id!)

        expect(w3cCredentialRepositoryDeleteMock).toBeCalledWith(agentContext, w3cCredentialRecord)
      })
    })

    describe('getAllCredentialRecords', () => {
      it('should retrieve all W3cCredentialRecords', async () => {
        const credential = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
          W3cVerifiableCredential
        )
        await w3cCredentialService.storeCredential(agentContext, { credential: credential })

        const records = await w3cCredentialService.getAllCredentialRecords(agentContext)

        expect(records.length).toEqual(1)
      })
    })
    describe('getCredentialRecordById', () => {
      it('should retrieve a W3cCredentialRecord by id', async () => {
        const credential = await w3cCredentialService.getCredentialRecordById(agentContext, w3cCredentialRecord.id)

        expect(credential.id).toEqual(w3cCredentialRecord.id)
      })
    })
  })
})
