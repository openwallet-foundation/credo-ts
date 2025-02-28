import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../../tests/helpers'
import { Agent } from '../../../../../agent/Agent'
import { AgentConfig } from '../../../../../agent/AgentConfig'
import { W3cCredentialRecord, W3cCredentialRepository, W3cJsonLdVerifiableCredential } from '../../../../../modules/vc'
import { W3cJsonLdCredentialService } from '../../../../../modules/vc/data-integrity/W3cJsonLdCredentialService'
import { Ed25519Signature2018Fixtures } from '../../../../../modules/vc/data-integrity/__tests__/fixtures'
import { JsonTransformer } from '../../../../../utils'
import * as testModule from '../w3cCredentialRecord'

const dependencyManager = {
  resolve: (_injectionToken: unknown) => {
    // no-op
  },
}

const agentConfig = getAgentConfig('Migration W3cCredentialRecord 0.4-0.5')
const agentContext = getAgentContext({
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  dependencyManager: dependencyManager as any,
})

const repository = {
  getAll: jest.fn(),
  update: jest.fn(),
}

const w3cJsonLdCredentialService = {
  getExpandedTypesForCredential: jest.fn().mockResolvedValue(['https://example.com#example']),
}

dependencyManager.resolve = (injectionToken: unknown) => {
  if (injectionToken === W3cJsonLdCredentialService) {
    return w3cJsonLdCredentialService
  }
  if (injectionToken === W3cCredentialRepository) {
    return repository
  }
  if (injectionToken === AgentConfig) {
    return agentConfig
  }

  throw new Error('unknown injection token')
}

jest.mock('../../../../../agent/Agent', () => {
  return {
    Agent: jest.fn(() => ({
      config: agentConfig,
      context: agentContext,
      dependencyManager,
    })),
  }
})

// Mock typed object
const AgentMock = Agent as jest.Mock<Agent>

describe('0.4-0.5 | W3cCredentialRecord', () => {
  let agent: Agent

  beforeEach(() => {
    agent = new AgentMock()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('migrateW3cCredentialRecordToV0_5()', () => {
    it('should fetch all w3c credential records and re-save them', async () => {
      const records = [
        new W3cCredentialRecord({
          tags: {
            expandedTypes: ['https://example.com'],
          },
          id: '3b3cf6ca-fa09-4498-b891-e280fbbb7fa7',
          credential: JsonTransformer.fromJSON(
            Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
            W3cJsonLdVerifiableCredential
          ),
        }),
      ]

      mockFunction(repository.getAll).mockResolvedValue(records)

      await testModule.migrateW3cCredentialRecordToV0_5(agent)

      expect(repository.getAll).toHaveBeenCalledTimes(1)
      expect(repository.getAll).toHaveBeenCalledWith(agent.context)
      expect(repository.update).toHaveBeenCalledTimes(1)

      const [, record] = mockFunction(repository.update).mock.calls[0]
      expect(record.getTags().types).toEqual(['VerifiableCredential', 'UniversityDegreeCredential'])
    })

    it("should re-calculate the expandedTypes if it contains 'https' values", async () => {
      const records = [
        new W3cCredentialRecord({
          tags: {
            expandedTypes: ['https'],
          },
          id: '3b3cf6ca-fa09-4498-b891-e280fbbb7fa7',
          credential: JsonTransformer.fromJSON(
            Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
            W3cJsonLdVerifiableCredential
          ),
        }),
      ]

      mockFunction(repository.getAll).mockResolvedValue(records)

      await testModule.migrateW3cCredentialRecordToV0_5(agent)

      expect(repository.getAll).toHaveBeenCalledTimes(1)
      expect(repository.getAll).toHaveBeenCalledWith(agent.context)
      expect(repository.update).toHaveBeenCalledTimes(1)

      const [, record] = mockFunction(repository.update).mock.calls[0]
      expect(record.getTags().expandedTypes).toEqual(['https://example.com#example'])
    })
  })
})
