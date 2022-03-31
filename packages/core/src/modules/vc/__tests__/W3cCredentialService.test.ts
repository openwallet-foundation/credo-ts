import type { AgentConfig } from '../../../agent/AgentConfig'

import { getAgentConfig } from '../../../../tests/helpers'
import { TestLogger } from '../../../../tests/logger'
import { Key, KeyType } from '../../../crypto'
import { LogLevel } from '../../../logger'
import { JsonTransformer } from '../../../utils'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { DidKey, DidResolverService } from '../../dids'
import { DidRepository } from '../../dids/repository'
import { IndyLedgerService } from '../../ledger/services/IndyLedgerService'
import { W3cCredentialService } from '../W3cCredentialService'
import { W3cCredential, W3cVerifiableCredential } from '../models'
import { W3cCredentialRepository } from '../models/credential/W3cCredentialRepository'
import { W3cPresentation } from '../models/presentation/W3Presentation'

import { validEd25519Signature2018VerifiableCredentialJson } from './fixtures'

jest.mock('../../ledger/services/IndyLedgerService')

const IndyLedgerServiceMock = IndyLedgerService as jest.Mock<IndyLedgerService>
const DidRepositoryMock = DidRepository as unknown as jest.Mock<DidRepository>

jest.mock('../models/credential/W3cCredentialRepository')
const W3cCredentialRepositoryMock = W3cCredentialRepository as jest.Mock<W3cCredentialRepository>

describe('W3cCredentialService', () => {
  let wallet: IndyWallet
  let agentConfig: AgentConfig
  let didResolverService: DidResolverService
  let logger: TestLogger
  let w3cCredentialService: W3cCredentialService
  let w3cCredentialRepository: W3cCredentialRepository

  beforeAll(async () => {
    agentConfig = getAgentConfig('W3cCredentialServiceTest')
    wallet = new IndyWallet(agentConfig)
    logger = new TestLogger(LogLevel.error)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(agentConfig.walletConfig!)
    await wallet.initPublicDid({})
    didResolverService = new DidResolverService(agentConfig, new IndyLedgerServiceMock(), new DidRepositoryMock())
    w3cCredentialRepository = new W3cCredentialRepositoryMock()
    w3cCredentialService = new W3cCredentialService(
      wallet,
      w3cCredentialRepository,
      didResolverService,
      agentConfig,
      logger
    )
  })

  afterAll(async () => {
    await wallet.delete()
  })

  xdescribe('store', () => {
    test('Store a credential', async () => {
      const credential = JsonTransformer.fromJSON(
        {
          '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
          type: ['VerifiableCredential', 'UniversityDegreeCredential'],
          issuer: 'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV',
          issuanceDate: '2017-10-22T12:23:48Z',
          credentialSubject: {
            degree: {
              type: 'BachelorDegree',
              name: 'Bachelor of Science and Arts',
            },
          },
          proof: {
            verificationMethod:
              'did:key:z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV#z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV',
            type: 'Ed25519Signature2018',
            created: '2022-03-28T15:54:59Z',
            proofPurpose: 'assertionMethod',
            jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..b0MD_c-8EyGATDuCda1A72qbjD3o8MfiipicmhnYmcdqoIyZzE9MlZ9FZn5sxsIJ3LPqPQj7y1jLlINwCwNSDg',
          },
        },
        W3cVerifiableCredential
      )

      const w3cCredentialRecord = await w3cCredentialService.storeCredential(credential)

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

  xdescribe('signCredential', () => {
    it('returns a signed credential', async () => {
      const pubDid = wallet.publicDid
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const key = Key.fromPublicKeyBase58(pubDid!.verkey, KeyType.Ed25519)
      const didKey = new DidKey(key)

      const credential = JsonTransformer.fromJSON(
        {
          '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
          // id: 'http://example.edu/credentials/temporary/28934792387492384',
          type: ['VerifiableCredential', 'UniversityDegreeCredential'],
          issuer: didKey.did,
          issuanceDate: '2017-10-22T12:23:48Z',
          credentialSubject: {
            degree: {
              type: 'BachelorDegree',
              name: 'Bachelor of Science and Arts',
            },
          },
        },
        W3cCredential
      )

      const vc = await w3cCredentialService.signCredential({
        options: {
          proofType: 'Ed25519Signature2018',
          verificationMethod: didKey.keyId,
        },
        credential,
      })
    })
  })
  xdescribe('verifyCredential', () => {
    it('credential should verify successfully', async () => {
      const vc = JsonTransformer.fromJSON(validEd25519Signature2018VerifiableCredentialJson, W3cVerifiableCredential)
      const result = await w3cCredentialService.verifyCredential(vc)
    })
  })

  describe('createPresentation', () => {
    it('Should successfully create a presentation from single verifiable credential', async () => {
      const vc = JsonTransformer.fromJSON(validEd25519Signature2018VerifiableCredentialJson, W3cVerifiableCredential)
      const result = await w3cCredentialService.createPresentation(vc)

      expect(result).toBeInstanceOf(W3cPresentation)

      expect(result.type).toEqual(expect.arrayContaining(['VerifiablePresentation']))

      expect(result.verifiableCredential).toHaveLength(1)
      expect(result.verifiableCredential).toEqual(expect.arrayContaining([vc]))
    })
    it('Should successfully create a presentation from two verifiable credential', async () => {
      const vc1 = JsonTransformer.fromJSON(validEd25519Signature2018VerifiableCredentialJson, W3cVerifiableCredential)
      const vc2 = JsonTransformer.fromJSON(validEd25519Signature2018VerifiableCredentialJson, W3cVerifiableCredential)

      const vcs = [vc1, vc2]
      const result = await w3cCredentialService.createPresentation(vcs)

      expect(result).toBeInstanceOf(W3cPresentation)

      expect(result.type).toEqual(expect.arrayContaining(['VerifiablePresentation']))

      expect(result.verifiableCredential).toHaveLength(2)
      expect(result.verifiableCredential).toEqual(expect.arrayContaining([vc1, vc2]))
    })
  })
})
