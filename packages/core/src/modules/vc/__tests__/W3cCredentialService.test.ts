import type { AgentConfig } from '../../../agent/AgentConfig'

import { getAgentConfig } from '../../../../tests/helpers'
import { TestLogger } from '../../../../tests/logger'
import { LogLevel } from '../../../logger'
import { JsonTransformer } from '../../../utils'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { DidResolverService } from '../../dids'
import { DidRepository } from '../../dids/repository'
import { IndyLedgerService } from '../../ledger/services/IndyLedgerService'
import { W3cCredentialService } from '../W3cCredentialService'
import { W3cCredential } from '../models'

const TEST_DID_KEY = 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL'

jest.mock('../../ledger/services/IndyLedgerService')

const IndyLedgerServiceMock = IndyLedgerService as jest.Mock<IndyLedgerService>
const DidRepositoryMock = DidRepository as unknown as jest.Mock<DidRepository>

describe('W3cCredentialService', () => {
  let wallet: IndyWallet
  let agentConfig: AgentConfig
  let didResolverService: DidResolverService
  let logger: TestLogger
  let w3cCredentialService: W3cCredentialService

  beforeAll(async () => {
    agentConfig = getAgentConfig('W3cCredentialServiceTest')
    wallet = new IndyWallet(agentConfig)
    logger = new TestLogger(LogLevel.error)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(agentConfig.walletConfig!)
    await wallet.initPublicDid({})
    didResolverService = new DidResolverService(agentConfig, new IndyLedgerServiceMock(), new DidRepositoryMock())
    w3cCredentialService = new W3cCredentialService(wallet, didResolverService, agentConfig, logger)
  })

  afterAll(async () => {
    await wallet.delete()
  })

  describe('sign', () => {
    it('returns a signed credential', async () => {
      const credential = JsonTransformer.fromJSON(
        {
          '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
          // id: 'http://example.edu/credentials/temporary/28934792387492384',
          type: ['VerifiableCredential', 'UniversityDegreeCredential'],
          issuer: TEST_DID_KEY,
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
          verificationMethod:
            'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
        },
        credential,
      })
      console.log(vc)
    })
  })
})
