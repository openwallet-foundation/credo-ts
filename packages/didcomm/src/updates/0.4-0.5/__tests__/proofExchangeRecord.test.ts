import { Agent } from '../../../../../core/src/agent/Agent'
import { JsonTransformer } from '../../../../../core/src/utils'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../core/tests'
import { DidCommProofExchangeRecord, DidCommProofExchangeRepository, DidCommProofRole, DidCommProofState } from '../../../modules/proofs'
import { DidCommMessageRecord, DidCommMessageRole } from '../../../repository'
import { DidCommMessageRepository } from '../../../repository/DidCommMessageRepository'
import * as testModule from '../proofExchangeRecord'

const agentConfig = getAgentConfig('Migration - Proof Exchange Record - 0.4-0.5')
const agentContext = getAgentContext()

jest.mock('../../../modules/proofs/repository/DidCommProofExchangeRepository')
const ProofRepositoryMock = DidCommProofExchangeRepository as jest.Mock<DidCommProofExchangeRepository>
const proofRepository = new ProofRepositoryMock()

jest.mock('../../../repository/DidCommMessageRepository')
const DidCommMessageRepositoryMock = DidCommMessageRepository as jest.Mock<DidCommMessageRepository>
const didCommMessageRepository = new DidCommMessageRepositoryMock()

jest.mock('../../../../../core/src/agent/Agent', () => ({
  Agent: jest.fn(() => ({
    config: agentConfig,
    context: agentContext,
    dependencyManager: {
      resolve: jest.fn((injectionToken) =>
        injectionToken === DidCommProofExchangeRepository ? proofRepository : didCommMessageRepository
      ),
    },
  })),
}))

// Mock typed object
const AgentMock = Agent as jest.Mock<Agent>

describe('0.4-0.5 | Migration | Proof Exchange Record', () => {
  let agent: Agent

  beforeEach(() => {
    agent = new AgentMock()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('migrateProofExchangeRecordToV0_5()', () => {
    it('should fetch all records and apply the needed updates ', async () => {
      const records: DidCommProofExchangeRecord[] = [getProofRecord({})]

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
    genMigrateRoleTests(DidCommProofState.RequestSent, DidCommProofRole.Verifier)
    genMigrateRoleTests(DidCommProofState.ProposalReceived, DidCommProofRole.Verifier)
    genMigrateRoleTests(DidCommProofState.PresentationReceived, DidCommProofRole.Verifier)

    genMigrateRoleTests(DidCommProofState.RequestReceived, DidCommProofRole.Prover)
    genMigrateRoleTests(DidCommProofState.Declined, DidCommProofRole.Prover)
    genMigrateRoleTests(DidCommProofState.ProposalSent, DidCommProofRole.Prover)
    genMigrateRoleTests(DidCommProofState.PresentationSent, DidCommProofRole.Prover)

    genMigrateRoleTests(DidCommProofState.Done, DidCommProofRole.Prover, {
      messageName: 'propose-presentation',
      didCommMessageRole: DidCommMessageRole.Sender,
    })
    genMigrateRoleTests(DidCommProofState.Abandoned, DidCommProofRole.Prover, {
      messageName: 'propose-presentation',
      didCommMessageRole: DidCommMessageRole.Sender,
    })

    genMigrateRoleTests(DidCommProofState.Done, DidCommProofRole.Verifier, {
      messageName: 'propose-presentation',
      didCommMessageRole: DidCommMessageRole.Receiver,
    })
    genMigrateRoleTests(DidCommProofState.Abandoned, DidCommProofRole.Verifier, {
      messageName: 'propose-presentation',
      didCommMessageRole: DidCommMessageRole.Receiver,
    })

    genMigrateRoleTests(DidCommProofState.Done, DidCommProofRole.Verifier, {
      messageName: 'request-presentation',
      didCommMessageRole: DidCommMessageRole.Sender,
    })
    genMigrateRoleTests(DidCommProofState.Abandoned, DidCommProofRole.Verifier, {
      messageName: 'request-presentation',
      didCommMessageRole: DidCommMessageRole.Sender,
    })

    genMigrateRoleTests(DidCommProofState.Done, DidCommProofRole.Prover, {
      messageName: 'request-presentation',
      didCommMessageRole: DidCommMessageRole.Receiver,
    })
    genMigrateRoleTests(DidCommProofState.Abandoned, DidCommProofRole.Prover, {
      messageName: 'request-presentation',
      didCommMessageRole: DidCommMessageRole.Receiver,
    })
  })

  function genMigrateRoleTests(
    state: DidCommProofState,
    role: DidCommProofRole,
    didCommMessage?: {
      messageName: 'propose-presentation' | 'request-presentation'
      didCommMessageRole: DidCommMessageRole
    }
  ) {
    it(`Should migrate state: '${state}' to role: '${role}'`, async () => {
      const record = getProofRecord({ state })

      if (didCommMessage) {
        mockFunction(didCommMessageRepository.findByQuery).mockResolvedValueOnce([
          new DidCommMessageRecord({
            message: {
              '@id': '123',
              '@type': `https://didcomm.org/present-proof/1.0/${didCommMessage.messageName}`,
            },
            role: didCommMessage.didCommMessageRole,
            associatedRecordId: record.id,
          }),
        ])
      }

      await testModule.migrateRole(agent, record)

      expect(record.toJSON()).toMatchObject({
        role,
      })

      if (didCommMessage) {
        expect(didCommMessageRepository.findByQuery).toHaveBeenCalledTimes(1)
        expect(didCommMessageRepository.findByQuery).toHaveBeenCalledWith(agent.context, {
          associatedRecordId: record.id,
          $or: [{ messageName: 'propose-presentation' }, { messageName: 'request-presentation' }],
        })
      }
    })
  }
})

function getProofRecord({ id, state }: { id?: string; state?: DidCommProofState }) {
  return JsonTransformer.fromJSON(
    {
      id: id ?? 'proof-id',
      state: state ?? DidCommProofState.ProposalSent,
    },
    DidCommProofExchangeRecord
  )
}
