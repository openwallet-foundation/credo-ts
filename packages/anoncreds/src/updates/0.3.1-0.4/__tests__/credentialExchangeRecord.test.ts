import type { MockedClassConstructor } from '../../../../../../tests/types'
import { JsonTransformer } from '../../../../../core/src'
import { Agent } from '../../../../../core/src/agent/Agent'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../core/tests'
import type { CredentialRecordBinding, DidCommCredentialState } from '../../../../../didcomm/src'
import { DidCommCredentialExchangeRecord } from '../../../../../didcomm/src'
import { DidCommCredentialExchangeRepository } from '../../../../../didcomm/src/modules/credentials/repository/DidCommCredentialExchangeRepository'
import * as testModule from '../credentialExchangeRecord'
import {
  migrateIndyCredentialMetadataToAnonCredsMetadata,
  migrateIndyCredentialTypeToAnonCredsCredential,
} from '../credentialExchangeRecord'

const agentConfig = getAgentConfig('AnonCreds Migration - Credential Exchange Record - 0.3.1-0.4.0')
const agentContext = getAgentContext()

vi.mock('../../../../../didcomm/src/modules/credentials/repository/DidCommCredentialExchangeRepository')
const CredentialRepositoryMock = DidCommCredentialExchangeRepository as MockedClassConstructor<
  typeof DidCommCredentialExchangeRepository
>
const credentialRepository = new CredentialRepositoryMock()

vi.mock('../../../../../core/src/agent/Agent', () => {
  return {
    Agent: vi.fn(() => ({
      config: agentConfig,
      context: agentContext,
      dependencyManager: {
        resolve: vi.fn(() => credentialRepository),
      },
    })),
  }
})

// Mock typed object
const AgentMock = Agent as MockedClassConstructor<typeof Agent>

describe('0.3.1-0.4.0 | AnonCreds Migration | Credential Exchange Record', () => {
  let agent: Agent

  beforeEach(() => {
    agent = new AgentMock()
  })

  describe('migrateCredentialExchangeRecordToV0_4()', () => {
    it('should fetch all records and apply the needed updates ', async () => {
      const records: DidCommCredentialExchangeRecord[] = [
        getCredentialRecord({
          metadata: {
            '_internal/indyCredential': { some: 'value' },
            '_internal/indyRequest': { nonce: 'nonce', master_secret_name: 'ms', master_secret_blinding_data: 'msbd' },
          },
          credentials: [
            {
              credentialRecordId: 'credential-id',
              credentialRecordType: 'indy',
            },
            {
              credentialRecordId: 'credential-id2',
              credentialRecordType: 'jsonld',
            },
          ],
        }),
      ]

      mockFunction(credentialRepository.getAll).mockResolvedValue(records)

      await testModule.migrateCredentialExchangeRecordToV0_4(agent)

      expect(credentialRepository.getAll).toHaveBeenCalledTimes(1)
      expect(credentialRepository.update).toHaveBeenCalledTimes(1)

      const [, credentialRecord] = mockFunction(credentialRepository.update).mock.calls[0]
      expect(credentialRecord.toJSON()).toMatchObject({
        metadata: {
          '_anoncreds/credential': { some: 'value' },
          '_anoncreds/credentialRequest': { nonce: 'nonce', link_secret_name: 'ms', link_secret_blinding_data: 'msbd' },
        },
        credentials: [
          {
            credentialRecordId: 'credential-id',
            credentialRecordType: 'anoncreds',
          },
          {
            credentialRecordId: 'credential-id2',
            credentialRecordType: 'jsonld',
          },
        ],
      })
    })
  })

  describe('migrateIndyCredentialMetadataToAnonCredsMetadata()', () => {
    test('updates indy metadata to anoncreds metadata', () => {
      const record = getCredentialRecord({
        metadata: {
          '_internal/indyCredential': { some: 'value' },
          '_internal/indyRequest': { nonce: 'nonce', master_secret_name: 'ms', master_secret_blinding_data: 'msbd' },
        },
      })

      migrateIndyCredentialMetadataToAnonCredsMetadata(agent, record)

      expect(record.toJSON()).toMatchObject({
        metadata: {
          '_anoncreds/credential': { some: 'value' },
          '_anoncreds/credentialRequest': { nonce: 'nonce', link_secret_name: 'ms', link_secret_blinding_data: 'msbd' },
        },
      })
    })
  })

  describe('migrateIndyCredentialTypeToAnonCredsCredential()', () => {
    test('updates indy credential record binding to anoncreds binding', () => {
      const record = getCredentialRecord({
        credentials: [
          {
            credentialRecordId: 'credential-id',
            credentialRecordType: 'indy',
          },
          {
            credentialRecordId: 'credential-id2',
            credentialRecordType: 'jsonld',
          },
        ],
      })

      migrateIndyCredentialTypeToAnonCredsCredential(agent, record)

      expect(record.toJSON()).toMatchObject({
        credentials: [
          {
            credentialRecordId: 'credential-id',
            credentialRecordType: 'anoncreds',
          },
          {
            credentialRecordId: 'credential-id2',
            credentialRecordType: 'jsonld',
          },
        ],
      })
    })
  })
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
