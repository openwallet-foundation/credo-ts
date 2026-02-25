import type { MockedClassConstructor } from '../../../../../../tests/types'
import { Agent } from '../../../../../core/src/agent/Agent'
import { JsonTransformer } from '../../../../../core/src/utils'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../core/tests/helpers'
import { DidCommProofExchangeRecord, DidCommProofState } from '../../../modules/proofs'
import { DidCommProofExchangeRepository } from '../../../modules/proofs/repository/DidCommProofExchangeRepository'
import { DidCommMessageRole } from '../../../repository'
import { DidCommMessageRepository } from '../../../repository/DidCommMessageRepository'
import * as testModule from '../proof'

const agentConfig = getAgentConfig('Migration DidCommProofExchangeRecord 0.2-0.3')
const agentContext = getAgentContext()

vi.mock('../../../modules/proofs/repository/DidCommProofExchangeRepository')
const ProofRepositoryMock = DidCommProofExchangeRepository as MockedClassConstructor<
  typeof DidCommProofExchangeRepository
>
const proofRepository = new ProofRepositoryMock()

vi.mock('../../../repository/DidCommMessageRepository')
const DidCommMessageRepositoryMock = DidCommMessageRepository as MockedClassConstructor<typeof DidCommMessageRepository>
const didCommMessageRepository = new DidCommMessageRepositoryMock()

vi.mock('../../../../../core/src/agent/Agent', () => {
  return {
    Agent: vi.fn(function () {
      return {
        config: agentConfig,
        context: agentContext,
        dependencyManager: {
          resolve: vi.fn(function (token) {
            return token === ProofRepositoryMock ? proofRepository : didCommMessageRepository
          }),
        },
      }
    }),
  }
})

// Mock typed object
const AgentMock = Agent as MockedClassConstructor<typeof Agent>

describe('0.2-0.3 | Proof', () => {
  let agent: Agent

  beforeEach(() => {
    agent = new AgentMock()
  })

  afterEach(() => {
    mockFunction(didCommMessageRepository.save).mockReset()
  })

  describe('migrateProofExchangeRecordToV0_3()', () => {
    it('should fetch all records and apply the needed updates ', async () => {
      const records: DidCommProofExchangeRecord[] = [getProof({})]

      mockFunction(proofRepository.getAll).mockResolvedValue(records)

      await testModule.migrateProofExchangeRecordToV0_3(agent)

      expect(proofRepository.getAll).toHaveBeenCalledTimes(1)
      expect(proofRepository.update).toHaveBeenCalledTimes(records.length)

      const updatedRecord = mockFunction(proofRepository.update).mock.calls[0][1]

      // Check first object is transformed correctly
      expect(updatedRecord.toJSON()).toMatchObject({
        protocolVersion: 'v1',
      })
    })
  })

  describe('migrateInternalProofExchangeRecordProperties()', () => {
    it('should set the protocol version to v1 if not set on the record', async () => {
      const proofRecord = getProof({})

      await testModule.migrateInternalProofExchangeRecordProperties(agent, proofRecord)

      expect(proofRecord).toMatchObject({
        protocolVersion: 'v1',
      })
    })

    it('should not set the protocol version if a value is already set', async () => {
      const proofRecord = getProof({
        protocolVersion: 'v2',
      })

      await testModule.migrateInternalProofExchangeRecordProperties(agent, proofRecord)

      expect(proofRecord).toMatchObject({
        protocolVersion: 'v2',
      })
    })
  })

  describe('moveDidCommMessages()', () => {
    it('should move the proposalMessage, requestMessage and presentationMessage to the didCommMessageRepository', async () => {
      const proposalMessage = { '@type': 'ProposalMessage' }
      const requestMessage = { '@type': 'RequestMessage' }
      const presentationMessage = { '@type': 'ProofMessage' }

      const proofRecord = getProof({
        id: 'theProofId',
        state: DidCommProofState.Done,
        proposalMessage,
        requestMessage,
        presentationMessage,
      })

      await testModule.moveDidCommMessages(agent, proofRecord)

      expect(didCommMessageRepository.save).toHaveBeenCalledTimes(3)
      const [[, proposalMessageRecord], [, requestMessageRecord], [, presentationMessageRecord]] = mockFunction(
        didCommMessageRepository.save
      ).mock.calls

      expect(proposalMessageRecord).toMatchObject({
        role: DidCommMessageRole.Sender,
        associatedRecordId: 'theProofId',
        message: proposalMessage,
      })

      expect(requestMessageRecord).toMatchObject({
        role: DidCommMessageRole.Receiver,
        associatedRecordId: 'theProofId',
        message: requestMessage,
      })

      expect(presentationMessageRecord).toMatchObject({
        role: DidCommMessageRole.Sender,
        associatedRecordId: 'theProofId',
        message: presentationMessage,
      })

      expect(proofRecord.toJSON()).toEqual({
        _tags: {},
        protocolVersion: undefined,
        id: 'theProofId',
        state: DidCommProofState.Done,
        metadata: {},
        isVerified: undefined,
      })
    })

    it('should only move the messages which exist in the record', async () => {
      const proposalMessage = { '@type': 'ProposalMessage' }

      const proofRecord = getProof({
        id: 'theProofId',
        state: DidCommProofState.Done,
        proposalMessage,
        isVerified: true,
      })

      await testModule.moveDidCommMessages(agent, proofRecord)

      expect(didCommMessageRepository.save).toHaveBeenCalledTimes(1)
      const [[, proposalMessageRecord]] = mockFunction(didCommMessageRepository.save).mock.calls

      expect(proposalMessageRecord).toMatchObject({
        role: DidCommMessageRole.Receiver,
        associatedRecordId: 'theProofId',
        message: proposalMessage,
      })

      expect(proofRecord.toJSON()).toEqual({
        _tags: {},
        protocolVersion: undefined,
        id: 'theProofId',
        state: DidCommProofState.Done,
        metadata: {},
        isVerified: true,
        presentationMessage: undefined,
        requestMessage: undefined,
      })
    })

    it('should determine the correct DidCommMessageRole for each message', async () => {
      const proposalMessage = { '@type': 'ProposalMessage' }
      const requestMessage = { '@type': 'RequestMessage' }
      const presentationMessage = { '@type': 'ProofMessage' }

      const proofRecord = getProof({
        id: 'theProofId',
        state: DidCommProofState.Done,
        proposalMessage,
        requestMessage,
        presentationMessage,
      })

      await testModule.moveDidCommMessages(agent, proofRecord)

      expect(didCommMessageRepository.save).toHaveBeenCalledTimes(3)
      const [[, proposalMessageRecord], [, requestMessageRecord], [, presentationMessageRecord]] = mockFunction(
        didCommMessageRepository.save
      ).mock.calls

      expect(proposalMessageRecord).toMatchObject({
        role: DidCommMessageRole.Sender,
        associatedRecordId: 'theProofId',
        message: proposalMessage,
      })

      expect(requestMessageRecord).toMatchObject({
        role: DidCommMessageRole.Receiver,
        associatedRecordId: 'theProofId',
        message: requestMessage,
      })

      expect(presentationMessageRecord).toMatchObject({
        role: DidCommMessageRole.Sender,
        associatedRecordId: 'theProofId',
        message: presentationMessage,
      })

      expect(proofRecord.toJSON()).toEqual({
        _tags: {},
        metadata: {},
        protocolVersion: undefined,
        id: 'theProofId',
        state: DidCommProofState.Done,
      })
    })
  })

  describe('getProofRole', () => {
    it('should return DidCommProofRole.Verifier if isVerified is set', () => {
      expect(
        testModule.getProofRole(
          getProof({
            isVerified: true,
          })
        )
      ).toBe(testModule.V02_03MigrationProofRole.Verifier)

      expect(
        testModule.getProofRole(
          getProof({
            isVerified: false,
          })
        )
      ).toBe(testModule.V02_03MigrationProofRole.Verifier)
    })

    it('should return DidCommProofRole.Prover if state is Done and isVerified is not set', () => {
      const proofRecord = getProof({
        state: DidCommProofState.Done,
      })

      expect(testModule.getProofRole(proofRecord)).toBe(testModule.V02_03MigrationProofRole.Prover)
    })

    it('should return DidCommProofRole.Prover if the value is a prover state', () => {
      const holderStates = [
        DidCommProofState.Declined,
        DidCommProofState.ProposalSent,
        DidCommProofState.RequestReceived,
        DidCommProofState.PresentationSent,
      ]

      for (const holderState of holderStates) {
        expect(
          testModule.getProofRole(
            getProof({
              state: holderState,
            })
          )
        ).toBe(testModule.V02_03MigrationProofRole.Prover)
      }
    })

    it('should return DidCommProofRole.Verifier if the state is not a prover state, isVerified is not set and the state is not Done', () => {
      expect(
        testModule.getProofRole(
          getProof({
            state: DidCommProofState.PresentationReceived,
          })
        )
      ).toBe(testModule.V02_03MigrationProofRole.Verifier)
    })
  })
})

function getProof({
  protocolVersion,
  proposalMessage,
  requestMessage,
  presentationMessage,
  state,
  isVerified,
  id,
}: {
  protocolVersion?: string
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  proposalMessage?: any
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  requestMessage?: any
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  presentationMessage?: any
  state?: DidCommProofState
  isVerified?: boolean
  id?: string
}) {
  return JsonTransformer.fromJSON(
    {
      protocolVersion,
      proposalMessage,
      requestMessage,
      presentationMessage,
      state,
      isVerified,
      id,
    },
    DidCommProofExchangeRecord
  )
}
