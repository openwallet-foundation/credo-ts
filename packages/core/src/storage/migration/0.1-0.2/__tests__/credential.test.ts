import { getAgentConfig, mockFunction } from '../../../../../tests/helpers'
import { Agent } from '../../../../agent/Agent'
import { CredentialRecord } from '../../../../modules/credentials'
import { CredentialRepository } from '../../../../modules/credentials/repository/CredentialRepository'
import { JsonTransformer } from '../../../../utils'
import * as testModule from '../credential'

const agentConfig = getAgentConfig('Migration CredentialRecord 0.1-0.2')

jest.mock('../../../../modules/credentials/repository/CredentialRepository')
const CredentialRepositoryMock = CredentialRepository as jest.Mock<CredentialRepository>
const credentialRepository = new CredentialRepositoryMock()

jest.mock('../../../../agent/Agent', () => {
  return {
    Agent: jest.fn(() => ({
      config: agentConfig,
      injectionContainer: {
        resolve: jest.fn(() => credentialRepository),
      },
    })),
  }
})

// Mock typed object
const AgentMock = Agent as jest.Mock<Agent>

describe('0.1-0.2 | Credential', () => {
  let agent: Agent

  beforeEach(() => {
    agent = new AgentMock()
  })

  describe('migrateCredentialRecordToV0_2()', () => {
    it('should fetch all records and apply the needed updates ', async () => {
      const records: CredentialRecord[] = [
        getCredentialWithMetadata({
          schemaId: 'schemaId',
          credentialDefinitionId: 'schemaId',
          anotherObject: {
            someNested: 'value',
          },
          requestMetadata: {
            the: {
              indy: {
                meta: 'data',
              },
            },
          },
        }),
      ]

      mockFunction(credentialRepository.getAll).mockResolvedValue(records)

      await testModule.migrateCredentialRecordToV0_2(agent)

      // FIXME: I can't get a spy / mock for 'updateIndyMetadata' working...
      expect(credentialRepository.getAll).toHaveBeenCalledTimes(1)
      expect(credentialRepository.update).toHaveBeenCalledTimes(records.length)

      // Check first object is transformed correctly
      expect(credentialRepository.update).toHaveBeenNthCalledWith(
        1,
        getCredentialWithMetadata({
          '_internal/indyCredential': {
            schemaId: 'schemaId',
            credentialDefinitionId: 'schemaId',
          },
          anotherObject: {
            someNested: 'value',
          },
          '_internal/indyRequest': {
            the: {
              indy: {
                meta: 'data',
              },
            },
          },
        })
      )
    })
  })

  describe('updateIndyMetadata()', () => {
    it('should correctly update the old top-level keys into the nested structure', async () => {
      const credentialRecord = getCredentialWithMetadata({
        schemaId: 'schemaId',
        credentialDefinitionId: 'schemaId',
        anotherObject: {
          someNested: 'value',
        },
        requestMetadata: {
          the: {
            indy: {
              meta: 'data',
            },
          },
        },
      })

      await testModule.updateIndyMetadata(agent, credentialRecord)

      expect(credentialRecord).toMatchObject({
        metadata: {
          data: {
            '_internal/indyCredential': {
              schemaId: 'schemaId',
              credentialDefinitionId: 'schemaId',
            },
            anotherObject: {
              someNested: 'value',
            },
            '_internal/indyRequest': {
              the: {
                indy: {
                  meta: 'data',
                },
              },
            },
          },
        },
      })
    })

    it('should not fail if some the top-level metadata keys do not exist', async () => {
      const credentialRecord = getCredentialWithMetadata({
        schemaId: 'schemaId',
        anotherObject: {
          someNested: 'value',
        },
      })

      await testModule.updateIndyMetadata(agent, credentialRecord)

      expect(credentialRecord).toMatchObject({
        metadata: {
          data: {
            '_internal/indyCredential': {
              schemaId: 'schemaId',
            },
            anotherObject: {
              someNested: 'value',
            },
          },
        },
      })
    })

    it('should not fail if all of the top-level metadata keys do not exist', async () => {
      const credentialRecord = getCredentialWithMetadata({
        anotherObject: {
          someNested: 'value',
        },
      })

      await testModule.updateIndyMetadata(agent, credentialRecord)

      expect(credentialRecord).toMatchObject({
        metadata: {
          data: {
            anotherObject: {
              someNested: 'value',
            },
          },
        },
      })
    })
  })
})

function getCredentialWithMetadata(metadata: Record<string, unknown>) {
  return JsonTransformer.fromJSON(
    {
      metadata,
    },
    CredentialRecord
  )
}
