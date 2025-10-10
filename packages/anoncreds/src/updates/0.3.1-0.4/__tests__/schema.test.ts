import type { AnonCredsSchema } from '../../../models'

import type { MockedClassConstructor } from '../../../../../../tests/types'
import { JsonTransformer } from '../../../../../core/src'
import { Agent } from '../../../../../core/src/agent/Agent'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../core/tests'
import { AnonCredsSchemaRecord } from '../../../repository'
import { AnonCredsSchemaRepository } from '../../../repository/AnonCredsSchemaRepository'
import * as testModule from '../schema'

const agentConfig = getAgentConfig('AnonCreds Migration - Credential Exchange Record - 0.3.1-0.4.0')
const agentContext = getAgentContext()

vi.mock('../../../repository/AnonCredsSchemaRepository')
const AnonCredsSchemaRepositoryMock = AnonCredsSchemaRepository as MockedClassConstructor<
  typeof AnonCredsSchemaRepository
>
const schemaRepository = new AnonCredsSchemaRepositoryMock()

vi.mock('../../../../../core/src/agent/Agent', () => {
  return {
    Agent: vi.fn(() => ({
      config: agentConfig,
      context: agentContext,
      dependencyManager: {
        resolve: vi.fn(() => schemaRepository),
      },
    })),
  }
})

// Mock typed object
const AgentMock = Agent as MockedClassConstructor<typeof Agent>

describe('0.3.1-0.4.0 | AnonCreds Migration | Schema Record', () => {
  let agent: Agent

  beforeEach(() => {
    agent = new AgentMock()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('migrateAnonCredsSchemaRecordToV0_4()', () => {
    it('should fetch all records and apply the needed updates', async () => {
      const records: AnonCredsSchemaRecord[] = [
        getSchemaRecord({
          schema: {
            attrNames: ['name', 'age'],
            id: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/SCHEMA/schema-name/1.0',
            name: 'schema-name',
            seqNo: 1,
            version: '1.0',
            ver: '1.0',
          },
        }),
      ]

      mockFunction(schemaRepository.getAll).mockResolvedValue(records)

      await testModule.migrateAnonCredsSchemaRecordToV0_4(agent)

      expect(schemaRepository.getAll).toHaveBeenCalledTimes(1)
      expect(schemaRepository.update).toHaveBeenCalledTimes(1)

      const [, schemaRecord] = mockFunction(schemaRepository.update).mock.calls[0]
      expect(schemaRecord.toJSON()).toMatchObject({
        schemaId: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/SCHEMA/schema-name/1.0',
        schema: {
          attrNames: ['name', 'age'],
          name: 'schema-name',
          version: '1.0',
          issuerId: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH',
        },
      })
    })

    it('should skip records that are already migrated to the 0.4.0 format', async () => {
      const records: AnonCredsSchemaRecord[] = [
        getSchemaRecord({
          schema: {
            attrNames: ['name', 'age'],
            name: 'schema-name',
            version: '1.0',
            issuerId: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH',
          },
          schemaId: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/SCHEMA/schema-name/1.0',
        }),
      ]

      mockFunction(schemaRepository.getAll).mockResolvedValue(records)

      await testModule.migrateAnonCredsSchemaRecordToV0_4(agent)

      expect(schemaRepository.getAll).toHaveBeenCalledTimes(1)
      expect(schemaRepository.update).toHaveBeenCalledTimes(0)
    })
  })
})

function getSchemaRecord({
  id,
  schema,
  schemaId,
}: {
  id?: string
  schema: testModule.OldSchema | AnonCredsSchema
  schemaId?: string
}) {
  return JsonTransformer.fromJSON(
    {
      id: id ?? 'schema-record-id',
      schema,
      schemaId,
    },
    AnonCredsSchemaRecord
  )
}
