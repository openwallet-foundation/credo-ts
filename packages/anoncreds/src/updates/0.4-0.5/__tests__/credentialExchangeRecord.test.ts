import type { CredentialRecordBinding } from '../../../../../core/src'

import { CredentialRole, CredentialState, CredentialExchangeRecord, JsonTransformer } from '../../../../../core/src'
import { Agent } from '../../../../../core/src/agent/Agent'
import { CredentialRepository } from '../../../../../core/src/modules/credentials/repository/CredentialRepository'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../core/tests'
import * as testModule from '../credentialExchangeRecord'

const agentConfig = getAgentConfig('AnonCreds Migration - Credential Exchange Record - 0.4-0.5')
const agentContext = getAgentContext()

jest.mock('../../../../../core/src/modules/credentials/repository/CredentialRepository')
const CredentialRepositoryMock = CredentialRepository as jest.Mock<CredentialRepository>
const credentialRepository = new CredentialRepositoryMock()

jest.mock('../../../../../core/src/agent/Agent', () => ({
  Agent: jest.fn(() => ({
    config: agentConfig,
    context: agentContext,
    dependencyManager: {
      resolve: jest.fn(() => credentialRepository),
    },
  })),
}))

// Mock typed object
const AgentMock = Agent as jest.Mock<Agent>

describe('0.4-0.5 | AnonCreds Migration | Credential Exchange Record', () => {
  let agent: Agent

  beforeAll(() => {
    agent = new AgentMock()
  })

  describe('migrateCredentialExchangeRecordToV0_5()', () => {
    it('should fetch all records and apply the needed updates ', async () => {
      const records: CredentialExchangeRecord[] = [getCredentialRecord({ state: CredentialState.OfferSent })]

      mockFunction(credentialRepository.getAll).mockResolvedValue(records)

      await testModule.migrateCredentialExchangeRecordToV0_5(agent)

      expect(credentialRepository.getAll).toHaveBeenCalledTimes(1)
      expect(credentialRepository.update).toHaveBeenCalledTimes(1)

      const [, credentialRecord] = mockFunction(credentialRepository.update).mock.calls[0]
      expect(credentialRecord.toJSON()).toMatchObject({
        role: CredentialRole.Issuer,
      })
    })
  })

  describe('migrateRole()', () => {
    // according to: https://github.com/hyperledger/aries-rfcs/blob/main/features/0036-issue-credential/README.md#states
    genMigrateRoleTests(CredentialState.ProposalReceived, CredentialRole.Issuer)
    genMigrateRoleTests(CredentialState.OfferSent, CredentialRole.Issuer)
    genMigrateRoleTests(CredentialState.RequestReceived, CredentialRole.Issuer)
    genMigrateRoleTests(CredentialState.CredentialIssued, CredentialRole.Issuer)
    genMigrateRoleTests(CredentialState.Done, CredentialRole.Issuer, false)

    genMigrateRoleTests(CredentialState.ProposalSent, CredentialRole.Holder)
    genMigrateRoleTests(CredentialState.OfferReceived, CredentialRole.Holder)
    genMigrateRoleTests(CredentialState.RequestSent, CredentialRole.Holder)
    genMigrateRoleTests(CredentialState.CredentialReceived, CredentialRole.Holder)
    genMigrateRoleTests(CredentialState.Done, CredentialRole.Holder, true)
  })

  function genMigrateRoleTests(state: CredentialState, expectedRole: CredentialRole, doneStateWithCredentials = false) {
    it(`Should migrate state: '${state}' to role: '${expectedRole}'`, async () => {
      const record = getCredentialRecord({
        state,
        credentials: doneStateWithCredentials
          ? [{ credentialRecordId: 'some-id', credentialRecordType: 'some-record' }]
          : undefined,
      })

      await testModule.migrateRole(agent, record)

      expect(record.toJSON()).toMatchObject({
        role: expectedRole,
      })
    })
  }
})

function getCredentialRecord({
  id,
  metadata,
  credentials,
  state,
}: {
  id?: string
  metadata?: Record<string, unknown>
  credentials?: CredentialRecordBinding[]
  state?: CredentialState
}) {
  return JsonTransformer.fromJSON(
    {
      id: id ?? 'credential-id',
      metadata,
      credentials,
      state,
    },
    CredentialExchangeRecord
  )
}
