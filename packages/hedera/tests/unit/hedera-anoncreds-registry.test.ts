import {
  type GetCredentialDefinitionReturn,
  type GetRevocationRegistryDefinitionReturn,
  type GetRevocationStatusListReturn,
  type GetSchemaReturn,
  type RegisterCredentialDefinitionOptions,
  type RegisterCredentialDefinitionReturn,
  type RegisterRevocationRegistryDefinitionOptions,
  type RegisterRevocationRegistryDefinitionReturn,
  type RegisterRevocationStatusListOptions,
  type RegisterRevocationStatusListReturn,
  type RegisterSchemaOptions,
  type RegisterSchemaReturn,
} from '@credo-ts/anoncreds'
import type { AgentContext } from '@credo-ts/core'
import { mockFunction } from '../../../core/tests/helpers'
import { HederaAnonCredsRegistry } from '../../src/anoncreds'
import { HederaAnonCredsService } from '../../src/anoncreds/HederaAnonCredsService'
import { HederaModuleConfig } from '../../src/HederaModuleConfig'

const mockAnonCredsService = vi.hoisted(() => ({
  registerSchema: vi.fn(),
  getSchema: vi.fn(),
  registerCredentialDefinition: vi.fn(),
  getCredentialDefinition: vi.fn(),
  registerRevocationRegistryDefinition: vi.fn(),
  getRevocationRegistryDefinition: vi.fn(),
  registerRevocationStatusList: vi.fn(),
  getRevocationStatusList: vi.fn(),
}))

vi.mock('../../src/anoncreds/HederaAnonCredsService', () => ({
  HederaAnonCredsService: vi.fn(function () {
    return mockAnonCredsService
  }),
}))

const mockHederaModuleConfig = {} as HederaModuleConfig

const mockAgentContext = {
  dependencyManager: {
    isRegistered: vi.fn().mockReturnValue(true),
    resolve: vi.fn().mockImplementation((cls) => {
      if (cls === HederaModuleConfig) return mockHederaModuleConfig
    }),
  },
  config: {
    logger: {
      trace: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    },
  },
} as unknown as AgentContext

describe('HederaAnonCredsRegistry', () => {
  const registry: HederaAnonCredsRegistry = new HederaAnonCredsRegistry()

  it('creates the AnonCreds service once from HederaModuleConfig and reuses it', async () => {
    const localRegistry = new HederaAnonCredsRegistry()
    vi.mocked(HederaAnonCredsService).mockClear()

    await localRegistry.getSchema(mockAgentContext, 'schema-1')
    await localRegistry.getSchema(mockAgentContext, 'schema-2')

    expect(HederaAnonCredsService).toHaveBeenCalledTimes(1)
    expect(HederaAnonCredsService).toHaveBeenCalledWith(mockHederaModuleConfig)
  })

  describe('registerSchema', () => {
    const options: RegisterSchemaOptions = {
      schema: {
        issuerId: 'issuer-did',
        name: 'schema-name',
        version: '1.0',
        attrNames: [],
      },
      options: {},
    }

    it('should call anonCredsService.registerSchema and return result on success', async () => {
      const expected: RegisterSchemaReturn = {
        schemaMetadata: {},
        registrationMetadata: {},
        schemaState: {
          state: 'finished',
          schema: options.schema,
          schemaId: expect.any(String),
        },
      }
      mockFunction(mockAnonCredsService.registerSchema).mockResolvedValue(expected)

      const result = await registry.registerSchema(mockAgentContext, options)

      expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith('Registering schema on Hedera ledger')
      expect(mockAgentContext.dependencyManager.resolve).toHaveBeenCalledWith(HederaModuleConfig)
      expect(mockAnonCredsService.registerSchema).toHaveBeenCalledWith(mockAgentContext, options)
      expect(result).toEqual(expected)
    })

    it('should catch error and return failed state', async () => {
      const error = new Error('fail')
      mockFunction(mockAnonCredsService.registerSchema).mockRejectedValue(error)

      const result = await registry.registerSchema(mockAgentContext, options)

      expect(mockAgentContext.config.logger.debug).toHaveBeenCalledWith(
        `Error registering schema for did '${options.schema.issuerId}'`,
        expect.objectContaining({ error, did: options.schema.issuerId, schema: options })
      )
      expect(result.schemaState.state).toBe('failed')
      if (result.schemaState.state === 'failed') expect(result.schemaState.reason).toContain('fail')
    })
  })

  describe('getSchema', () => {
    const mockSchemaId = 'mock-schema-id'

    it('reports when HederaModule is not registered', async () => {
      const dependencyManager = {
        isRegistered: vi.fn().mockReturnValue(false),
        resolve: vi.fn(),
      }
      const agentContext = {
        ...mockAgentContext,
        dependencyManager,
      } as unknown as AgentContext

      const result = await new HederaAnonCredsRegistry().getSchema(agentContext, mockSchemaId)

      expect(result.resolutionMetadata.message).toContain('Add HederaModule from @credo-ts/hedera to the agent modules')
      expect(dependencyManager.resolve).not.toHaveBeenCalled()
    })

    it('should call anonCredsService.getSchema and return result on success', async () => {
      const expected: GetSchemaReturn = {
        schemaId: mockSchemaId,
        resolutionMetadata: {},
        schemaMetadata: {},
      }
      mockFunction(mockAnonCredsService.getSchema).mockResolvedValue(expected)

      const result = await registry.getSchema(mockAgentContext, mockSchemaId)

      expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith(
        `Resolving schema '${mockSchemaId}' from Hedera ledger`
      )
      expect(mockAnonCredsService.getSchema).toHaveBeenCalledWith(mockAgentContext, mockSchemaId)
      expect(result).toEqual(expected)
    })

    it('should catch error and return notFound error state', async () => {
      const error = new Error('not found')
      mockFunction(mockAnonCredsService.getSchema).mockRejectedValue(error)

      const result = await registry.getSchema(mockAgentContext, mockSchemaId)

      expect(mockAgentContext.config.logger.error).toHaveBeenCalledWith(
        `Error retrieving schema '${mockSchemaId}'`,
        expect.objectContaining({ error, schemaId: mockSchemaId })
      )
      expect(result.resolutionMetadata.error).toBe('notFound')
      expect(result.resolutionMetadata.message).toContain('not found')
    })
  })

  describe('registerCredentialDefinition', () => {
    const options: RegisterCredentialDefinitionOptions = {
      options: {},
      credentialDefinition: {
        issuerId: 'did:hedera:issuer',
        schemaId: '',
        type: 'CL',
        tag: '',
        value: {
          primary: {},
          revocation: undefined,
        },
      },
    }

    it('should call anonCredsService.registerCredentialDefinition and return result on success', async () => {
      const expected: RegisterCredentialDefinitionReturn = {
        credentialDefinitionMetadata: {},
        registrationMetadata: {},
        credentialDefinitionState: {
          state: 'finished',
          credentialDefinition: {
            issuerId: '',
            schemaId: '',
            type: 'CL',
            tag: '',
            value: {
              primary: {},
              revocation: undefined,
            },
          },
          credentialDefinitionId: 'did:hedera:issuerId',
        },
      }
      mockFunction(mockAnonCredsService.registerCredentialDefinition).mockResolvedValue(expected)

      const result = await registry.registerCredentialDefinition(mockAgentContext, options)

      expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith(
        'Registering credential definition on Hedera ledger'
      )
      expect(mockAnonCredsService.registerCredentialDefinition).toHaveBeenCalledWith(mockAgentContext, options)
      expect(result).toEqual(expected)
    })

    it('should catch error and return failed state', async () => {
      const error = new Error('fail')
      mockFunction(mockAnonCredsService.registerCredentialDefinition).mockRejectedValue(error)

      const result = await registry.registerCredentialDefinition(mockAgentContext, options)

      expect(mockAgentContext.config.logger.error).toHaveBeenCalledWith(
        `Error registering credential definition for did '${options.credentialDefinition.issuerId}'`,
        expect.objectContaining({ error, did: options.credentialDefinition.issuerId, schema: options })
      )
      expect(result.credentialDefinitionState.state).toBe('failed')
      if (result.credentialDefinitionState.state === 'failed')
        expect(result.credentialDefinitionState.reason).toContain('fail')
    })
  })

  describe('getCredentialDefinition', () => {
    const mockCredentialDefinitionId = 'mock-cred-def-id'

    it('should call anonCredsService.getCredentialDefinition and return result on success', async () => {
      const expected: GetCredentialDefinitionReturn = {
        credentialDefinitionId: mockCredentialDefinitionId,
        resolutionMetadata: {},
        credentialDefinitionMetadata: {},
      }
      mockFunction(mockAnonCredsService.getCredentialDefinition).mockResolvedValue(expected)

      const result = await registry.getCredentialDefinition(mockAgentContext, mockCredentialDefinitionId)

      expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith(
        `Resolving credential definition '${mockCredentialDefinitionId}' from Hedera ledger`
      )
      expect(mockAnonCredsService.getCredentialDefinition).toHaveBeenCalledWith(
        mockAgentContext,
        mockCredentialDefinitionId
      )
      expect(result).toEqual(expected)
    })

    it('should catch error and return notFound error state', async () => {
      const error = new Error('not found')
      mockFunction(mockAnonCredsService.getCredentialDefinition).mockRejectedValue(error)

      const result = await registry.getCredentialDefinition(mockAgentContext, mockCredentialDefinitionId)

      expect(mockAgentContext.config.logger.error).toHaveBeenCalledWith(
        `Error retrieving credential definition '${mockCredentialDefinitionId}'`,
        expect.objectContaining({ error, credentialDefinitionId: mockCredentialDefinitionId })
      )
      expect(result.resolutionMetadata.error).toBe('notFound')
      expect(result.resolutionMetadata.message).toContain('not found')
    })
  })

  describe('registerRevocationRegistryDefinition', () => {
    const options: RegisterRevocationRegistryDefinitionOptions = {
      options: {},
      revocationRegistryDefinition: {
        credDefId: 'credDef1',
        issuerId: 'did:hedera:issuer',
        revocDefType: 'CL_ACCUM',
        tag: '',
        value: {
          publicKeys: {
            accumKey: {
              z: '',
            },
          },
          maxCredNum: 0,
          tailsLocation: '',
          tailsHash: '',
        },
      },
    }

    it('should call ledgerService.registerRevocationRegistryDefinition and return result on success', async () => {
      const expected: RegisterRevocationRegistryDefinitionReturn = {
        revocationRegistryDefinitionMetadata: {},
        registrationMetadata: {},
        revocationRegistryDefinitionState: {
          state: 'finished',
          revocationRegistryDefinitionId: 'test',
          revocationRegistryDefinition: {
            issuerId: '',
            revocDefType: 'CL_ACCUM',
            credDefId: '',
            tag: '',
            value: {
              publicKeys: {
                accumKey: {
                  z: '',
                },
              },
              maxCredNum: 0,
              tailsLocation: '',
              tailsHash: '',
            },
          },
        },
      }
      mockFunction(mockAnonCredsService.registerRevocationRegistryDefinition).mockResolvedValue(expected)

      const result = await registry.registerRevocationRegistryDefinition(mockAgentContext, options)

      expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith(
        `Registering revocation registry definition for '${options.revocationRegistryDefinition.credDefId}' on Hedera ledger`
      )
      expect(mockAnonCredsService.registerRevocationRegistryDefinition).toHaveBeenCalledWith(mockAgentContext, options)
      expect(result).toEqual(expected)
    })

    it('should catch error and return failed state', async () => {
      const error = new Error('fail')
      mockFunction(mockAnonCredsService.registerRevocationRegistryDefinition).mockRejectedValue(error)

      const result = await registry.registerRevocationRegistryDefinition(mockAgentContext, options)

      expect(mockAgentContext.config.logger.error).toHaveBeenCalledWith(
        `Error registering revocation registry definition for did '${options.revocationRegistryDefinition.issuerId}'`,
        expect.objectContaining({ error, did: options.revocationRegistryDefinition.issuerId, options })
      )
      expect(result.revocationRegistryDefinitionState.state).toBe('failed')
      if (result.revocationRegistryDefinitionState.state === 'failed')
        expect(result.revocationRegistryDefinitionState.reason).toContain('fail')
    })
  })

  describe('getRevocationRegistryDefinition', () => {
    const mockRevocationRegistryDefinitionId = 'mock-rev-reg-def-id'

    it('should call ledgerService.getRevocationRegistryDefinition and return result on success', async () => {
      const expected: GetRevocationRegistryDefinitionReturn = {
        revocationRegistryDefinitionId: mockRevocationRegistryDefinitionId,
        resolutionMetadata: {},
        revocationRegistryDefinitionMetadata: {},
      }
      mockFunction(mockAnonCredsService.getRevocationRegistryDefinition).mockResolvedValue(expected)

      const result = await registry.getRevocationRegistryDefinition(
        mockAgentContext,
        mockRevocationRegistryDefinitionId
      )

      expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith(
        `Resolving revocation registry definition for '${mockRevocationRegistryDefinitionId}' from Hedera ledger`
      )
      expect(mockAnonCredsService.getRevocationRegistryDefinition).toHaveBeenCalledWith(
        mockAgentContext,
        mockRevocationRegistryDefinitionId
      )
      expect(result).toEqual(expected)
    })

    it('should catch error and return notFound error state', async () => {
      const error = new Error('not found')
      mockFunction(mockAnonCredsService.getRevocationRegistryDefinition).mockRejectedValue(error)

      const result = await registry.getRevocationRegistryDefinition(
        mockAgentContext,
        mockRevocationRegistryDefinitionId
      )

      expect(mockAgentContext.config.logger.error).toHaveBeenCalledWith(
        `Error retrieving revocation registry definition '${mockRevocationRegistryDefinitionId}'`,
        expect.objectContaining({ error, revocationRegistryDefinitionId: mockRevocationRegistryDefinitionId })
      )
      expect(result.resolutionMetadata.error).toBe('notFound')
      expect(result.resolutionMetadata.message).toContain('not found')
    })
  })

  describe('registerRevocationStatusList', () => {
    const options: RegisterRevocationStatusListOptions = {
      options: {},
      revocationStatusList: {
        revRegDefId: 'regDef1',
        issuerId: 'did:hedera:issuer',
        revocationList: [],
        currentAccumulator: '',
      },
    }

    it('should call ledgerService.registerRevocationStatusList and return the status list timestamp in seconds', async () => {
      const serviceResult: RegisterRevocationStatusListReturn = {
        jobId: 'job-1',
        revocationStatusListMetadata: { metadataKey: 'metadata' },
        registrationMetadata: { registrationKey: 'registration' },
        revocationStatusListState: {
          state: 'finished',
          revocationStatusList: {
            revRegDefId: 'regDef1',
            issuerId: 'did:hedera:issuer',
            revocationList: [0, 1, 0],
            timestamp: 1700000000123,
            currentAccumulator: 'accumulator',
          },
        },
      }
      const serviceResultSnapshot = structuredClone(serviceResult)
      mockFunction(mockAnonCredsService.registerRevocationStatusList).mockResolvedValue(serviceResult)

      const result = await registry.registerRevocationStatusList(mockAgentContext, options)

      expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith(
        `Registering revocation status list for '${options.revocationStatusList.revRegDefId}' on Hedera ledger`
      )
      expect(mockAnonCredsService.registerRevocationStatusList).toHaveBeenCalledWith(mockAgentContext, options)
      expect(result).toEqual({
        jobId: 'job-1',
        revocationStatusListMetadata: { metadataKey: 'metadata' },
        registrationMetadata: { registrationKey: 'registration' },
        revocationStatusListState: {
          state: 'finished',
          revocationStatusList: {
            revRegDefId: 'regDef1',
            issuerId: 'did:hedera:issuer',
            revocationList: [0, 1, 0],
            timestamp: 1700000000,
            currentAccumulator: 'accumulator',
          },
        },
      })
      expect(serviceResult).toEqual(serviceResultSnapshot)
    })

    it('should return a failed result from the service unchanged', async () => {
      const serviceResult: RegisterRevocationStatusListReturn = {
        revocationStatusListMetadata: {},
        registrationMetadata: {},
        revocationStatusListState: {
          state: 'failed',
          reason: 'ledger rejected the status list',
          revocationStatusList: {
            revRegDefId: 'regDef1',
            issuerId: 'did:hedera:issuer',
            revocationList: [],
            timestamp: 1700000000123,
            currentAccumulator: '',
          },
        },
      }
      const serviceResultSnapshot = structuredClone(serviceResult)
      mockFunction(mockAnonCredsService.registerRevocationStatusList).mockResolvedValue(serviceResult)

      const result = await registry.registerRevocationStatusList(mockAgentContext, options)

      expect(result).toBe(serviceResult)
      expect(result).toEqual(serviceResultSnapshot)
    })

    it('should catch error and return failed state', async () => {
      const error = new Error('fail')
      mockFunction(mockAnonCredsService.registerRevocationStatusList).mockRejectedValue(error)

      const result = await registry.registerRevocationStatusList(mockAgentContext, options)

      expect(mockAgentContext.config.logger.error).toHaveBeenCalledWith(
        `Error registering revocation status list for did '${options.revocationStatusList.issuerId}'`,
        expect.objectContaining({ error, did: options.revocationStatusList.issuerId, options })
      )
      expect(result.revocationStatusListState.state).toBe('failed')
      if (result.revocationStatusListState.state === 'failed')
        expect(result.revocationStatusListState.reason).toContain('fail')
    })
  })

  describe('getRevocationStatusList', () => {
    const mockRevocationRegistryId = 'mock-rev-reg-def-id'
    const timestamp = 1234567890

    const serviceResultFor = (requestedTimestampMs: number): GetRevocationStatusListReturn => ({
      resolutionMetadata: { resolutionKey: 'resolution' },
      revocationStatusListMetadata: { metadataKey: 'metadata' },
      revocationStatusList: {
        revRegDefId: mockRevocationRegistryId,
        issuerId: 'did:hedera:issuer',
        revocationList: [0, 1, 0],
        currentAccumulator: 'accumulator',
        timestamp: requestedTimestampMs,
      },
    })

    it('should call ledgerService.getRevocationStatusList in milliseconds and return the timestamp in seconds', async () => {
      const serviceResult = serviceResultFor(timestamp * 1000 + 999)
      const serviceResultSnapshot = structuredClone(serviceResult)
      mockFunction(mockAnonCredsService.getRevocationStatusList).mockResolvedValue(serviceResult)

      const result = await registry.getRevocationStatusList(mockAgentContext, mockRevocationRegistryId, timestamp)

      expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith(
        `Resolving revocation status for for '${mockRevocationRegistryId}' from Hedera ledger`
      )
      expect(mockAnonCredsService.getRevocationStatusList).toHaveBeenCalledWith(
        mockAgentContext,
        mockRevocationRegistryId,
        timestamp * 1000 + 999
      )
      expect(result).toEqual({
        resolutionMetadata: { resolutionKey: 'resolution' },
        revocationStatusListMetadata: { metadataKey: 'metadata' },
        revocationStatusList: {
          revRegDefId: mockRevocationRegistryId,
          issuerId: 'did:hedera:issuer',
          revocationList: [0, 1, 0],
          currentAccumulator: 'accumulator',
          timestamp,
        },
      })
      expect(serviceResult).toEqual(serviceResultSnapshot)
    })

    it('should request the same millisecond timestamp when resolving again with the returned timestamp', async () => {
      const getRevocationStatusList = mockFunction(mockAnonCredsService.getRevocationStatusList)
      getRevocationStatusList.mockReset()
      getRevocationStatusList.mockImplementation(async (_agentContext, _revocationRegistryId, requestedTimestampMs) =>
        serviceResultFor(requestedTimestampMs)
      )

      const first = await registry.getRevocationStatusList(mockAgentContext, mockRevocationRegistryId, timestamp)
      const returnedTimestamp = first.revocationStatusList?.timestamp
      expect(returnedTimestamp).toBe(timestamp)

      const second = await registry.getRevocationStatusList(
        mockAgentContext,
        mockRevocationRegistryId,
        returnedTimestamp as number
      )

      expect(getRevocationStatusList).toHaveBeenCalledTimes(2)
      expect(getRevocationStatusList.mock.calls[1][2]).toBe(getRevocationStatusList.mock.calls[0][2])
      expect(second.revocationStatusList?.timestamp).toBe(timestamp)
    })

    it('should return a result without a status list unchanged', async () => {
      const serviceResult: GetRevocationStatusListReturn = {
        resolutionMetadata: { error: 'notFound', message: 'status list not found' },
        revocationStatusListMetadata: {},
      }
      mockFunction(mockAnonCredsService.getRevocationStatusList).mockResolvedValue(serviceResult)

      const result = await registry.getRevocationStatusList(mockAgentContext, mockRevocationRegistryId, timestamp)

      expect(result).toBe(serviceResult)
      expect(result).toEqual({
        resolutionMetadata: { error: 'notFound', message: 'status list not found' },
        revocationStatusListMetadata: {},
      })
    })

    it('should catch error and return notFound error state', async () => {
      const error = new Error('not found')
      mockFunction(mockAnonCredsService.getRevocationStatusList).mockRejectedValue(error)

      const result = await registry.getRevocationStatusList(mockAgentContext, mockRevocationRegistryId, timestamp)

      expect(mockAgentContext.config.logger.error).toHaveBeenCalledWith(
        `Error retrieving revocation registry status list '${mockRevocationRegistryId}'`,
        expect.objectContaining({ error, revocationRegistryId: mockRevocationRegistryId })
      )
      expect(result.resolutionMetadata.error).toBe('notFound')
      expect(result.resolutionMetadata.message).toContain('not found')
    })
  })
})
