import { ProofExchangeRecord, ProofRepository, JsonTransformer, ProofState, ProofRole } from '../../../../../core/src'
import { Agent } from '../../../../../core/src/agent/Agent'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../core/tests'
import * as testModule from '../proofExchangeRecord'

const agentConfig = getAgentConfig('AnonCreds Migration - Proof Exchange Record - 0.4-0.5')
const agentContext = getAgentContext()

jest.mock('../../../../../core/src/modules/proofs/repository/ProofRepository')
const ProofRepositoryMock = ProofRepository as jest.Mock<ProofRepository>
const proofRepository = new ProofRepositoryMock()

jest.mock('../../../../../core/src/agent/Agent', () => ({
  Agent: jest.fn(() => ({
    config: agentConfig,
    context: agentContext,
    dependencyManager: {
      resolve: jest.fn(() => proofRepository),
    },
  })),
}))

// Mock typed object
const AgentMock = Agent as jest.Mock<Agent>

describe('0.4-0.5 | AnonCreds Migration | Proof Exchange Record', () => {
  let agent: Agent

  beforeEach(() => {
    agent = new AgentMock()
  })

  describe('migrateProofExchangeRecordToV0_5()', () => {
    it('should fetch all records and apply the needed updates ', async () => {
      const records: ProofExchangeRecord[] = [getProofRecord({})]

      mockFunction(proofRepository.getAll).mockResolvedValue(records)

      await testModule.migrateProofExchangeRecordToV0_5(agent)

      expect(proofRepository.getAll).toHaveBeenCalledTimes(1)
      expect(proofRepository.update).toHaveBeenCalledTimes(1)
    })
  })

  /*
   *
   * Does not cover the `Abandoned` and `Done` state.
   * These are covered in the integration tests as they required more state setup in the walletj
   *
   */
  describe('migrateRole()', () => {
    // according to: https://github.com/hyperledger/aries-rfcs/blob/main/features/0037-present-proof/README.md#states
    genMigrateRoleTests(ProofState.RequestSent, ProofRole.Verifier)
    genMigrateRoleTests(ProofState.ProposalReceived, ProofRole.Verifier)
    genMigrateRoleTests(ProofState.PresentationReceived, ProofRole.Verifier)

    genMigrateRoleTests(ProofState.RequestReceived, ProofRole.Prover)
    genMigrateRoleTests(ProofState.ProposalSent, ProofRole.Prover)
    genMigrateRoleTests(ProofState.PresentationSent, ProofRole.Prover)
  })

  function genMigrateRoleTests(state: ProofState, role: ProofRole) {
    it(`Should migrate state: '${state}' to role: '${role}'`, async () => {
      const record = getProofRecord({ state })

      await testModule.migrateRole(agent, record)

      expect(record.toJSON()).toMatchObject({
        role,
      })
    })
  }
})

function getProofRecord({ id, state }: { id?: string; state?: ProofState }) {
  return JsonTransformer.fromJSON(
    {
      id: id ?? 'proof-id',
      state: state ?? ProofState.ProposalSent,
    },
    ProofExchangeRecord
  )
}
