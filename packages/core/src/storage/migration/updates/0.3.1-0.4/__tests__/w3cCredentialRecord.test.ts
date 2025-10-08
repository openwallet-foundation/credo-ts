import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../../tests/helpers'
import { Agent } from '../../../../../agent/Agent'
import { W3cCredentialRecord, W3cJsonLdVerifiableCredential } from '../../../../../modules/vc'
import { Ed25519Signature2018Fixtures } from '../../../../../modules/vc/data-integrity/__tests__/fixtures'
import { JsonTransformer } from '../../../../../utils'
import * as testModule from '../w3cCredentialRecord'

const agentConfig = getAgentConfig('Migration W3cCredentialRecord 0.3.1-0.4')
const agentContext = getAgentContext()

const repository = {
  getAll: vi.fn(),
  update: vi.fn(),
}

jest.mock('../../../../../agent/Agent', () => {
  return {
    Agent: vi.fn(() => ({
      config: agentConfig,
      context: agentContext,
      dependencyManager: {
        resolve: vi.fn(() => repository),
      },
    })),
  }
})

// Mock typed object
const AgentMock = Agent as jest.Mock<Agent>

describe('0.3.1-0.4 | W3cCredentialRecord', () => {
  let agent: Agent

  beforeEach(() => {
    agent = new AgentMock()
  })

  describe('migrateW3cCredentialRecordToV0_4()', () => {
    it('should fetch all w3c credential records and re-save them', async () => {
      const records = [
        new W3cCredentialRecord({
          tags: {},
          id: '3b3cf6ca-fa09-4498-b891-e280fbbb7fa7',
          credential: JsonTransformer.fromJSON(
            Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
            W3cJsonLdVerifiableCredential
          ),
        }),
      ]

      mockFunction(repository.getAll).mockResolvedValue(records)

      await testModule.migrateW3cCredentialRecordToV0_4(agent)

      expect(repository.getAll).toHaveBeenCalledTimes(1)
      expect(repository.getAll).toHaveBeenCalledWith(agent.context)
      expect(repository.update).toHaveBeenCalledTimes(1)

      const [, record] = mockFunction(repository.update).mock.calls[0]
      expect(record.getTags().claimFormat).toEqual('ldp_vc')
    })
  })
})
