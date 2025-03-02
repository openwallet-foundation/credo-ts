import type { AgentContext } from '../../../agent'
import type { Wallet } from '../../../wallet'

import { InMemoryWallet } from '../../../../../../tests/InMemoryWallet'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../tests'
import { JwsService } from '../../../crypto'
import { JsonTransformer, asArray } from '../../../utils'
import { W3cCredentialService } from '../W3cCredentialService'
import { W3cCredentialsModuleConfig } from '../W3cCredentialsModuleConfig'
import { W3cJsonLdVerifiableCredential } from '../data-integrity'
import { SignatureSuiteRegistry } from '../data-integrity/SignatureSuiteRegistry'
import { W3cJsonLdCredentialService } from '../data-integrity/W3cJsonLdCredentialService'
import { customDocumentLoader } from '../data-integrity/__tests__/documentLoader'
import { Ed25519Signature2018Fixtures } from '../data-integrity/__tests__/fixtures'
import jsonld from '../data-integrity/libraries/jsonld'
import { W3cJwtCredentialService } from '../jwt-vc'
import { W3cPresentation } from '../models'
import { W3cCredentialRecord, W3cCredentialRepository } from '../repository'

jest.mock('../repository/W3cCredentialRepository')
const W3cCredentialsRepositoryMock = W3cCredentialRepository as jest.Mock<W3cCredentialRepository>

const agentConfig = getAgentConfig('W3cCredentialServiceTest')

// Helper func
const credentialRecordFactory = async (credential: W3cJsonLdVerifiableCredential) => {
  const expandedTypes = (
    await jsonld.expand(JsonTransformer.toJSON(credential), { documentLoader: customDocumentLoader() })
  )[0]['@type']

  // Create an instance of the w3cCredentialRecord
  return new W3cCredentialRecord({
    tags: { expandedTypes: asArray(expandedTypes) },
    credential: credential,
  })
}

const credentialsModuleConfig = new W3cCredentialsModuleConfig({
  documentLoader: customDocumentLoader,
})

describe('W3cCredentialsService', () => {
  let wallet: Wallet
  let agentContext: AgentContext
  let w3cCredentialService: W3cCredentialService
  let w3cCredentialsRepository: W3cCredentialRepository

  beforeAll(async () => {
    wallet = new InMemoryWallet()
    await wallet.createAndOpen(agentConfig.walletConfig)
    agentContext = getAgentContext({
      agentConfig,
      wallet,
    })
    w3cCredentialsRepository = new W3cCredentialsRepositoryMock()
    w3cCredentialService = new W3cCredentialService(
      w3cCredentialsRepository,
      new W3cJsonLdCredentialService(new SignatureSuiteRegistry([]), credentialsModuleConfig),
      new W3cJwtCredentialService(new JwsService())
    )
  })

  afterAll(async () => {
    await wallet.delete()
  })

  describe('createPresentation', () => {
    it('should successfully create a presentation from single verifiable credential', async () => {
      const vc = JsonTransformer.fromJSON(
        Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
        W3cJsonLdVerifiableCredential
      )
      const result = await w3cCredentialService.createPresentation({ credentials: [vc] })

      expect(result).toBeInstanceOf(W3cPresentation)

      expect(result.type).toEqual(expect.arrayContaining(['VerifiablePresentation']))

      expect(result.verifiableCredential).toHaveLength(1)
      expect(result.verifiableCredential).toEqual([vc])
    })

    it('should successfully create a presentation from two verifiable credential', async () => {
      const vc1 = JsonTransformer.fromJSON(
        Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
        W3cJsonLdVerifiableCredential
      )
      const vc2 = JsonTransformer.fromJSON(
        Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
        W3cJsonLdVerifiableCredential
      )

      const vcs = [vc1, vc2]
      const result = await w3cCredentialService.createPresentation({ credentials: vcs })

      expect(result).toBeInstanceOf(W3cPresentation)

      expect(result.type).toEqual(expect.arrayContaining(['VerifiablePresentation']))

      expect(result.verifiableCredential).toHaveLength(2)
      expect(result.verifiableCredential).toEqual(expect.arrayContaining([vc1, vc2]))
    })
  })

  describe('Credential Storage', () => {
    let w3cCredentialRecord: W3cCredentialRecord
    let w3cCredentialRepositoryDeleteMock: jest.MockedFunction<(typeof w3cCredentialsRepository)['deleteById']>

    beforeEach(async () => {
      const credential = JsonTransformer.fromJSON(
        Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
        W3cJsonLdVerifiableCredential
      )

      w3cCredentialRecord = await credentialRecordFactory(credential)

      mockFunction(w3cCredentialsRepository.getById).mockResolvedValue(w3cCredentialRecord)
      mockFunction(w3cCredentialsRepository.getAll).mockResolvedValue([w3cCredentialRecord])
      w3cCredentialRepositoryDeleteMock = mockFunction(w3cCredentialsRepository.deleteById).mockResolvedValue()
    })
    describe('storeCredential', () => {
      it('should store a credential and expand the tags correctly', async () => {
        const credential = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
          W3cJsonLdVerifiableCredential
        )

        w3cCredentialRecord = await w3cCredentialService.storeCredential(agentContext, { credential: credential })

        expect(w3cCredentialRecord).toMatchObject({
          type: 'W3cCredentialRecord',
          id: expect.any(String),
          createdAt: expect.any(Date),
          credential: expect.any(W3cJsonLdVerifiableCredential),
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
        await w3cCredentialService.removeCredentialRecord(agentContext, 'some-id')

        expect(w3cCredentialRepositoryDeleteMock).toBeCalledWith(agentContext, 'some-id')
      })
    })

    describe('getAllCredentialRecords', () => {
      it('should retrieve all W3cCredentialRecords', async () => {
        const credential = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
          W3cJsonLdVerifiableCredential
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
