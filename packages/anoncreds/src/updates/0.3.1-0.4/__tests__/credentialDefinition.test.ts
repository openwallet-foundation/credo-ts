import type { AnonCredsCredentialDefinition } from '../../../models'

import { JsonTransformer } from '../../../../../core/src'
import { Agent } from '../../../../../core/src/agent/Agent'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../core/tests'
import { InMemoryAnonCredsRegistry } from '../../../../tests/InMemoryAnonCredsRegistry'
import { AnonCredsCredentialDefinitionRecord } from '../../../repository'
import { AnonCredsCredentialDefinitionRepository } from '../../../repository/AnonCredsCredentialDefinitionRepository'
import * as testModule from '../credentialDefinition'

const agentConfig = getAgentConfig('AnonCreds Migration - Credential Exchange Record - 0.3.1-0.4.0')
const agentContext = getAgentContext()

jest.mock('../../../repository/AnonCredsCredentialDefinitionRepository')
const AnonCredsCredentialDefinitionRepositoryMock =
  AnonCredsCredentialDefinitionRepository as jest.Mock<AnonCredsCredentialDefinitionRepository>
const credentialDefinitionRepository = new AnonCredsCredentialDefinitionRepositoryMock()

const inMemoryAnonCredsRegistry = new InMemoryAnonCredsRegistry({
  existingCredentialDefinitions: {
    'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/CLAIM_DEF/104/default': {
      schemaId: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/SCHEMA/credentialDefinition-name/1.0',
      tag: 'default',
      type: 'CL',
      value: {
        primary: {
          master_secret: '119999 00192381',
        },
      },
      issuerId: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH',
    },
  },
})

const registryService = {
  getRegistryForIdentifier: () => inMemoryAnonCredsRegistry,
}
jest.mock('../../../../../core/src/agent/Agent', () => {
  return {
    Agent: vi.fn(() => ({
      config: agentConfig,
      context: agentContext,
      dependencyManager: {
        resolve: vi.fn((injectionSymbol) =>
          injectionSymbol === AnonCredsCredentialDefinitionRepository ? credentialDefinitionRepository : registryService
        ),
      },
    })),
  }
})

// Mock typed object
const AgentMock = Agent as jest.Mock<Agent>

describe('0.3.1-0.4.0 | AnonCreds Migration | Credential Definition Record', () => {
  let agent: Agent

  beforeEach(() => {
    agent = new AgentMock()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('migrateAnonCredsCredentialDefinitionRecordToV0_4()', () => {
    it('should fetch all records and apply the needed updates', async () => {
      const records: AnonCredsCredentialDefinitionRecord[] = [
        getCredentialDefinitionRecord({
          credentialDefinition: {
            id: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/CLAIM_DEF/104/default',
            schemaId: '104',
            tag: 'default',
            type: 'CL',
            value: {
              primary: {
                master_secret: '119999 00192381',
              },
            },
            ver: '1.0',
          },
        }),
      ]

      mockFunction(credentialDefinitionRepository.getAll).mockResolvedValue(records)

      await testModule.migrateAnonCredsCredentialDefinitionRecordToV0_4(agent)

      expect(credentialDefinitionRepository.getAll).toHaveBeenCalledTimes(1)
      expect(credentialDefinitionRepository.update).toHaveBeenCalledTimes(1)

      const [, credentialDefinitionRecord] = mockFunction(credentialDefinitionRepository.update).mock.calls[0]
      expect(credentialDefinitionRecord.toJSON()).toMatchObject({
        credentialDefinitionId: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/CLAIM_DEF/104/default',
        credentialDefinition: {
          schemaId: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/SCHEMA/credentialDefinition-name/1.0',
          tag: 'default',
          type: 'CL',
          value: {
            primary: {
              master_secret: '119999 00192381',
            },
          },
          issuerId: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH',
        },
      })
    })

    it('should skip records that are already migrated to the 0.4.0 format', async () => {
      const records: AnonCredsCredentialDefinitionRecord[] = [
        getCredentialDefinitionRecord({
          credentialDefinitionId: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/CLAIM_DEF/104/default',
          credentialDefinition: {
            schemaId: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/SCHEMA/credentialDefinition-name/1.0',
            tag: 'default',
            type: 'CL',
            value: {
              primary: {
                master_secret: '119999 00192381',
              },
            },
            issuerId: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH',
          },
        }),
      ]

      mockFunction(credentialDefinitionRepository.getAll).mockResolvedValue(records)

      await testModule.migrateAnonCredsCredentialDefinitionRecordToV0_4(agent)

      expect(credentialDefinitionRepository.getAll).toHaveBeenCalledTimes(1)
      expect(credentialDefinitionRepository.update).toHaveBeenCalledTimes(0)
    })
  })
})

function getCredentialDefinitionRecord({
  id,
  credentialDefinition,
  credentialDefinitionId,
}: {
  id?: string
  credentialDefinition: testModule.OldCredentialDefinition | AnonCredsCredentialDefinition
  credentialDefinitionId?: string
}) {
  return JsonTransformer.fromJSON(
    {
      id: id ?? 'credentialDefinition-record-id',
      credentialDefinition,
      credentialDefinitionId,
    },
    AnonCredsCredentialDefinitionRecord
  )
}
