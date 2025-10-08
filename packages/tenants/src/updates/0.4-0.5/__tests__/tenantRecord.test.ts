import { Agent, JsonTransformer } from '@credo-ts/core'

import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../core/tests'
import { TenantRecord } from '../../../repository'
import { TenantRepository } from '../../../repository/TenantRepository'
import * as testModule from '../tenantRecord'

const agentConfig = getAgentConfig('Tenants Migration - Tenant Record - 0.4-0.5.0')
const agentContext = getAgentContext()

TenantRepository
jest.mock('../../../repository/TenantRepository')
const TenantRepositoryMock = TenantRepository as jest.Mock<TenantRepository>
const tenantRepository = new TenantRepositoryMock()

jest.mock('../../../../../core/src/agent/Agent', () => {
  return {
    Agent: vi.fn(() => ({
      config: agentConfig,
      context: agentContext,
      dependencyManager: {
        resolve: vi.fn(() => tenantRepository),
      },
    })),
  }
})

// Mock typed object
const AgentMock = Agent as jest.Mock<Agent>

describe('0.4-0.5 | Tenants Migration | Tenant Record', () => {
  let agent: Agent

  beforeEach(() => {
    agent = new AgentMock()
  })

  describe('migrateTenantRecordToV0_5()', () => {
    it('should fetch all records and apply the needed updates ', async () => {
      const records: TenantRecord[] = [
        getTenantRecord({
          label: 'Tenant 1',
        }),
      ]

      mockFunction(tenantRepository.getAll).mockResolvedValue(records)

      await testModule.migrateTenantRecordToV0_5(agent)

      expect(tenantRepository.getAll).toHaveBeenCalledTimes(1)
      expect(tenantRepository.update).toHaveBeenCalledTimes(1)

      const [, credentialRecord] = mockFunction(tenantRepository.update).mock.calls[0]
      expect(credentialRecord.getTags()).toMatchObject({
        label: 'Tenant 1',
      })
    })
  })
})

function getTenantRecord({ id, label }: { id?: string; label: string }) {
  return JsonTransformer.fromJSON(
    {
      id: id ?? 'credential-id',
      config: {
        label,
      },
    },
    TenantRecord
  )
}
