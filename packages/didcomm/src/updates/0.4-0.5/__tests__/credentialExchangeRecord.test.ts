import type { MockedClassConstructor } from '../../../../../../tests/types'
import { Agent } from '../../../../../core/src/agent/Agent'
import { JsonTransformer } from '../../../../../core/src/utils'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../core/tests'
import type { CredentialRecordBinding } from '../../../modules/credentials'
import {
  DidCommCredentialExchangeRecord,
  DidCommCredentialRole,
  DidCommCredentialState,
} from '../../../modules/credentials'
import { DidCommCredentialExchangeRepository } from '../../../modules/credentials/repository/DidCommCredentialExchangeRepository'
import { DidCommMessageRecord, DidCommMessageRole } from '../../../repository'
import { DidCommMessageRepository } from '../../../repository/DidCommMessageRepository'
import * as testModule from '../credentialExchangeRecord'

const agentConfig = getAgentConfig('Migration - Credential Exchange Record - 0.4-0.5')
const agentContext = getAgentContext()

vi.mock('../../../modules/credentials/repository/DidCommCredentialExchangeRepository')
const CredentialRepositoryMock = DidCommCredentialExchangeRepository as MockedClassConstructor<
  typeof DidCommCredentialExchangeRepository
>
const credentialRepository = new CredentialRepositoryMock()

vi.mock('../../../repository/DidCommMessageRepository')
const DidCommMessageRepositoryMock = DidCommMessageRepository as MockedClassConstructor<typeof DidCommMessageRepository>
const didCommMessageRepository = new DidCommMessageRepositoryMock()

vi.mock('../../../../../core/src/agent/Agent', () => ({
  Agent: vi.fn(function () {
    return {
      config: agentConfig,
      context: agentContext,
      dependencyManager: {
        resolve: vi.fn(function (injectionToken) {
          return injectionToken === DidCommCredentialExchangeRepository
            ? credentialRepository
            : didCommMessageRepository
        }),
      },
    }
  }),
}))

// Mock typed object
const AgentMock = Agent as MockedClassConstructor<typeof Agent>

describe('0.4-0.5 | Migration | Credential Exchange Record', () => {
  let agent: Agent

  beforeAll(() => {
    agent = new AgentMock()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('migrateCredentialExchangeRecordToV0_5()', () => {
    it('should fetch all records and apply the needed updates ', async () => {
      const records: DidCommCredentialExchangeRecord[] = [
        getCredentialRecord({ state: DidCommCredentialState.OfferSent }),
      ]

      mockFunction(credentialRepository.getAll).mockResolvedValue(records)

      await testModule.migrateCredentialExchangeRecordToV0_5(agent)

      expect(credentialRepository.getAll).toHaveBeenCalledTimes(1)
      expect(credentialRepository.update).toHaveBeenCalledTimes(1)

      const [, credentialRecord] = mockFunction(credentialRepository.update).mock.calls[0]
      expect(credentialRecord.toJSON()).toMatchObject({
        role: DidCommCredentialRole.Issuer,
      })
    })
  })

  describe('migrateRole()', () => {
    // according to: https://github.com/hyperledger/aries-rfcs/blob/main/features/0036-issue-credential/README.md#states
    genMigrateRoleTests(DidCommCredentialState.ProposalReceived, DidCommCredentialRole.Issuer)
    genMigrateRoleTests(DidCommCredentialState.OfferSent, DidCommCredentialRole.Issuer)
    genMigrateRoleTests(DidCommCredentialState.RequestReceived, DidCommCredentialRole.Issuer)
    genMigrateRoleTests(DidCommCredentialState.CredentialIssued, DidCommCredentialRole.Issuer)
    genMigrateRoleTests(DidCommCredentialState.Done, DidCommCredentialRole.Issuer, { doneStateWithCredentials: false })

    genMigrateRoleTests(DidCommCredentialState.ProposalSent, DidCommCredentialRole.Holder)
    genMigrateRoleTests(DidCommCredentialState.OfferReceived, DidCommCredentialRole.Holder)
    genMigrateRoleTests(DidCommCredentialState.RequestSent, DidCommCredentialRole.Holder)
    genMigrateRoleTests(DidCommCredentialState.CredentialReceived, DidCommCredentialRole.Holder)
    genMigrateRoleTests(DidCommCredentialState.Done, DidCommCredentialRole.Holder, { doneStateWithCredentials: true })
    genMigrateRoleTests(DidCommCredentialState.Declined, DidCommCredentialRole.Holder)

    genMigrateRoleTests(DidCommCredentialState.Abandoned, DidCommCredentialRole.Issuer, {
      didCommMessage: { messageName: 'propose-credential', didCommMessageRole: DidCommMessageRole.Receiver },
    })
    genMigrateRoleTests(DidCommCredentialState.Abandoned, DidCommCredentialRole.Holder, {
      didCommMessage: { messageName: 'propose-credential', didCommMessageRole: DidCommMessageRole.Sender },
    })

    genMigrateRoleTests(DidCommCredentialState.Abandoned, DidCommCredentialRole.Holder, {
      didCommMessage: { messageName: 'offer-credential', didCommMessageRole: DidCommMessageRole.Receiver },
    })
    genMigrateRoleTests(DidCommCredentialState.Abandoned, DidCommCredentialRole.Issuer, {
      didCommMessage: { messageName: 'offer-credential', didCommMessageRole: DidCommMessageRole.Sender },
    })

    genMigrateRoleTests(DidCommCredentialState.Abandoned, DidCommCredentialRole.Issuer, {
      didCommMessage: { messageName: 'request-credential', didCommMessageRole: DidCommMessageRole.Receiver },
    })
    genMigrateRoleTests(DidCommCredentialState.Abandoned, DidCommCredentialRole.Holder, {
      didCommMessage: { messageName: 'request-credential', didCommMessageRole: DidCommMessageRole.Sender },
    })
  })

  function genMigrateRoleTests(
    state: DidCommCredentialState,
    expectedRole: DidCommCredentialRole,
    {
      doneStateWithCredentials,
      didCommMessage,
    }: {
      doneStateWithCredentials?: boolean
      didCommMessage?: {
        messageName: 'propose-credential' | 'offer-credential' | 'request-credential'
        didCommMessageRole: DidCommMessageRole
      }
    } = {}
  ) {
    it(`Should migrate state: '${state}' to role: '${expectedRole}'${
      doneStateWithCredentials !== undefined
        ? ` when record ${doneStateWithCredentials ? 'has' : 'does not have'} credentials property`
        : ''
    }`, async () => {
      const record = getCredentialRecord({
        state,
        credentials: doneStateWithCredentials
          ? [{ credentialRecordId: 'some-id', credentialRecordType: 'some-record' }]
          : undefined,
      })

      if (didCommMessage) {
        mockFunction(didCommMessageRepository.findByQuery).mockResolvedValueOnce([
          new DidCommMessageRecord({
            message: {
              '@id': '123',
              '@type': `https://didcomm.org/issue-credential/1.0/${didCommMessage.messageName}`,
            },
            role: didCommMessage.didCommMessageRole,
            associatedRecordId: record.id,
          }),
        ])
      }

      await testModule.migrateRole(agent, record)

      expect(record.toJSON()).toMatchObject({
        role: expectedRole,
      })

      if (didCommMessage) {
        expect(didCommMessageRepository.findByQuery).toHaveBeenCalledTimes(1)
        expect(didCommMessageRepository.findByQuery).toHaveBeenCalledWith(agent.context, {
          associatedRecordId: record.id,
          $or: [
            { messageName: 'offer-credential' },
            { messageName: 'propose-credential' },
            { messageName: 'request-credential' },
          ],
        })
      }
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
  state?: DidCommCredentialState
}) {
  return JsonTransformer.fromJSON(
    {
      id: id ?? 'credential-id',
      metadata,
      credentials,
      state,
    },
    DidCommCredentialExchangeRecord
  )
}
