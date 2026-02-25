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
import { AgentContext } from '@credo-ts/core'
import { mockFunction } from '../../../core/tests/helpers'
import { HederaAnonCredsRegistry } from '../../src/anoncreds/HederaAnonCredsRegistry'
import { HederaLedgerService } from '../../src/ledger/HederaLedgerService'

const mockLedgerService = {
  registerSchema: vi.fn(),
  getSchema: vi.fn(),
  registerCredentialDefinition: vi.fn(),
  getCredentialDefinition: vi.fn(),
  registerRevocationRegistryDefinition: vi.fn(),
  getRevocationRegistryDefinition: vi.fn(),
  registerRevocationStatusList: vi.fn(),
  getRevocationStatusList: vi.fn(),
} as unknown as HederaLedgerService

const mockAgentContext = {
  dependencyManager: {
    resolve: vi.fn().mockImplementation((cls) => {
      if (cls === HederaLedgerService) return mockLedgerService
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

    it('should call ledgerService.registerSchema and return result on success', async () => {
      const expected: RegisterSchemaReturn = {
        schemaMetadata: {},
        registrationMetadata: {},
        schemaState: {
          state: 'finished',
          schema: options.schema,
          schemaId: expect.any(String),
        },
      }
      mockFunction(mockLedgerService.registerSchema).mockResolvedValue(expected)

      const result = await registry.registerSchema(mockAgentContext, options)

      expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith('Registering schema on Hedera ledger')
      expect(mockAgentContext.dependencyManager.resolve).toHaveBeenCalledWith(
        expect.any(Function) || HederaLedgerService
      )
      expect(mockLedgerService.registerSchema).toHaveBeenCalledWith(mockAgentContext, options)
      expect(result).toEqual(expected)
    })

    it('should catch error and return failed state', async () => {
      const error = new Error('fail')
      mockFunction(mockLedgerService.registerSchema).mockRejectedValue(error)

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

    it('should call ledgerService.getSchema and return result on success', async () => {
      const expected: GetSchemaReturn = {
        schemaId: mockSchemaId,
        resolutionMetadata: {},
        schemaMetadata: {},
      }
      mockFunction(mockLedgerService.getSchema).mockResolvedValue(expected)

      const result = await registry.getSchema(mockAgentContext, mockSchemaId)

      expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith(
        `Resolving schema '${mockSchemaId}' from Hedera ledger`
      )
      expect(mockLedgerService.getSchema).toHaveBeenCalledWith(mockAgentContext, mockSchemaId)
      expect(result).toEqual(expected)
    })

    it('should catch error and return notFound error state', async () => {
      const error = new Error('not found')
      mockFunction(mockLedgerService.getSchema).mockRejectedValue(error)

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

    it('should call ledgerService.registerCredentialDefinition and return result on success', async () => {
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
      mockFunction(mockLedgerService.registerCredentialDefinition).mockResolvedValue(expected)

      const result = await registry.registerCredentialDefinition(mockAgentContext, options)

      expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith(
        'Registering credential definition on Hedera ledger'
      )
      expect(mockLedgerService.registerCredentialDefinition).toHaveBeenCalledWith(mockAgentContext, options)
      expect(result).toEqual(expected)
    })

    it('should catch error and return failed state', async () => {
      const error = new Error('fail')
      mockFunction(mockLedgerService.registerCredentialDefinition).mockRejectedValue(error)

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

    it('should call ledgerService.getCredentialDefinition and return result on success', async () => {
      const expected: GetCredentialDefinitionReturn = {
        credentialDefinitionId: mockCredentialDefinitionId,
        resolutionMetadata: {},
        credentialDefinitionMetadata: {},
      }
      mockFunction(mockLedgerService.getCredentialDefinition).mockResolvedValue(expected)

      const result = await registry.getCredentialDefinition(mockAgentContext, mockCredentialDefinitionId)

      expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith(
        `Resolving credential definition '${mockCredentialDefinitionId}' from Hedera ledger`
      )
      expect(mockLedgerService.getCredentialDefinition).toHaveBeenCalledWith(
        mockAgentContext,
        mockCredentialDefinitionId
      )
      expect(result).toEqual(expected)
    })

    it('should catch error and return notFound error state', async () => {
      const error = new Error('not found')
      mockFunction(mockLedgerService.getCredentialDefinition).mockRejectedValue(error)

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
      mockFunction(mockLedgerService.registerRevocationRegistryDefinition).mockResolvedValue(expected)

      const result = await registry.registerRevocationRegistryDefinition(mockAgentContext, options)

      expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith(
        `Registering revocation registry definition for '${options.revocationRegistryDefinition.credDefId}' on Hedera ledger`
      )
      expect(mockLedgerService.registerRevocationRegistryDefinition).toHaveBeenCalledWith(mockAgentContext, options)
      expect(result).toEqual(expected)
    })

    it('should catch error and return failed state', async () => {
      const error = new Error('fail')
      mockFunction(mockLedgerService.registerRevocationRegistryDefinition).mockRejectedValue(error)

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
      mockFunction(mockLedgerService.getRevocationRegistryDefinition).mockResolvedValue(expected)

      const result = await registry.getRevocationRegistryDefinition(
        mockAgentContext,
        mockRevocationRegistryDefinitionId
      )

      expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith(
        `Resolving revocation registry definition for '${mockRevocationRegistryDefinitionId}' from Hedera ledger`
      )
      expect(mockLedgerService.getRevocationRegistryDefinition).toHaveBeenCalledWith(
        mockAgentContext,
        mockRevocationRegistryDefinitionId
      )
      expect(result).toEqual(expected)
    })

    it('should catch error and return notFound error state', async () => {
      const error = new Error('not found')
      mockFunction(mockLedgerService.getRevocationRegistryDefinition).mockRejectedValue(error)

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

    it('should call ledgerService.registerRevocationStatusList and return result on success', async () => {
      const expected: RegisterRevocationStatusListReturn = {
        revocationStatusListMetadata: {},
        registrationMetadata: {},
        revocationStatusListState: {
          state: 'finished',
          revocationStatusList: {
            revRegDefId: '',
            issuerId: '',
            revocationList: [],
            timestamp: 0,
            currentAccumulator: '',
          },
        },
      }
      mockFunction(mockLedgerService.registerRevocationStatusList).mockResolvedValue(expected)

      const result = await registry.registerRevocationStatusList(mockAgentContext, options)

      expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith(
        `Registering revocation status list for '${options.revocationStatusList.revRegDefId}' on Hedera ledger`
      )
      expect(mockLedgerService.registerRevocationStatusList).toHaveBeenCalledWith(mockAgentContext, options)
      expect(result).toEqual(expected)
    })

    it('should catch error and return failed state', async () => {
      const error = new Error('fail')
      mockFunction(mockLedgerService.registerRevocationStatusList).mockRejectedValue(error)

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

    it('should call ledgerService.getRevocationStatusList and return result on success', async () => {
      const expected: GetRevocationStatusListReturn = {
        resolutionMetadata: {},
        revocationStatusListMetadata: {},
      }
      mockFunction(mockLedgerService.getRevocationStatusList).mockResolvedValue(expected)

      const result = await registry.getRevocationStatusList(mockAgentContext, mockRevocationRegistryId, timestamp)

      expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith(
        `Resolving revocation status for for '${mockRevocationRegistryId}' from Hedera ledger`
      )
      expect(mockLedgerService.getRevocationStatusList).toHaveBeenCalledWith(
        mockAgentContext,
        mockRevocationRegistryId,
        timestamp * 1000
      )
      expect(result).toEqual(expected)
    })

    it('should catch error and return notFound error state', async () => {
      const error = new Error('not found')
      mockFunction(mockLedgerService.getRevocationStatusList).mockRejectedValue(error)

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
