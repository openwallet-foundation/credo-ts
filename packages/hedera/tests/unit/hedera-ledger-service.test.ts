import {
  RegisterCredentialDefinitionOptions,
  RegisterRevocationRegistryDefinitionOptions,
  RegisterRevocationStatusListOptions,
  RegisterSchemaOptions,
} from '@credo-ts/anoncreds'
import { DidDocument, DidRecord, DidRepository, TypedArrayEncoder } from '@credo-ts/core'
import { AgentContext } from '@credo-ts/core'
import { DidDocumentKey, Kms } from '@credo-ts/core'
import { Client, PrivateKey } from '@hashgraph/sdk'
import { HederaLedgerService } from '../../src/ledger/HederaLedgerService'

jest.mock('@hiero-did-sdk/registrar', () => ({
  DIDUpdateBuilder: vi.fn().mockReturnValue({
    addService: vi.fn().mockReturnThis(),
    removeService: vi.fn().mockReturnThis(),
    addVerificationMethod: vi.fn().mockReturnThis(),
    removeVerificationMethod: vi.fn().mockReturnThis(),
    addAssertionMethod: vi.fn().mockReturnThis(),
    removeAssertionMethod: vi.fn().mockReturnThis(),
    addAuthenticationMethod: vi.fn().mockReturnThis(),
    removeAuthenticationMethod: vi.fn().mockReturnThis(),
    addCapabilityDelegationMethod: vi.fn().mockReturnThis(),
    removeCapabilityDelegationMethod: vi.fn().mockReturnThis(),
    addCapabilityInvocationMethod: vi.fn().mockReturnThis(),
    removeCapabilityInvocationMethod: vi.fn().mockReturnThis(),
    addKeyAgreementMethod: vi.fn().mockReturnThis(),
    removeKeyAgreementMethod: vi.fn().mockReturnThis(),
    build: vi.fn(),
  }),
  generateCreateDIDRequest: vi.fn(),
  submitCreateDIDRequest: vi.fn(),
  generateUpdateDIDRequest: vi.fn(),
  submitUpdateDIDRequest: vi.fn(),
  generateDeactivateDIDRequest: vi.fn(),
  submitDeactivateDIDRequest: vi.fn(),
}))

import {
  CreateDIDRequest,
  DIDUpdateBuilder,
  DeactivateDIDRequest,
  UpdateDIDRequest,
  generateCreateDIDRequest,
  generateDeactivateDIDRequest,
  generateUpdateDIDRequest,
  submitCreateDIDRequest,
  submitDeactivateDIDRequest,
  submitUpdateDIDRequest,
} from '@hiero-did-sdk/registrar'

jest.mock('@hiero-did-sdk/resolver', () => ({
  resolveDID: vi.fn(),
  TopicReaderHederaHcs: vi.fn(),
}))

import { resolveDID } from '@hiero-did-sdk/resolver'

import { DID_ROOT_KEY_ID } from '@hiero-did-sdk/core'
import { mockFunction } from '../../../core/tests/helpers'
import { HederaAnonCredsRegistry } from '../../src/anoncreds/HederaAnonCredsRegistry'
import { did, didDocument } from './fixtures/did-document'

const privateKey = PrivateKey.generateED25519()

const mockKeyId = 'mock-key-id'

const mockPublicJwk: Kms.KmsJwkPublicOkp & { crv: 'Ed25519' } = {
  crv: 'Ed25519',
  kty: 'OKP',
  x: TypedArrayEncoder.toBase64URL(privateKey.publicKey.toBytesRaw()),
  kid: 'test-key-id',
}

const mockKms = {
  sign: vi.fn().mockResolvedValue({ signature: new Uint8Array([1, 2, 3]) }),
  getPublicKey: vi.fn().mockReturnValue(mockPublicJwk),
} as unknown as Kms.KeyManagementApi

const mockDidRepository = {
  findCreatedDid: vi.fn().mockResolvedValue({
    keys: [
      {
        didDocumentRelativeKeyId: DID_ROOT_KEY_ID,
        kmsKeyId: 'kmsKeyId',
      },
    ],
  }),
} as unknown as DidRepository

const mockAgentContext = {
  dependencyManager: {
    resolve: vi.fn((cls) => {
      if (cls === Kms.KeyManagementApi) {
        return mockKms
      }
      if (cls === DidRepository) {
        return mockDidRepository
      }
      throw new Error(`No instance found for ${cls}`)
    }),
  },
} as unknown as AgentContext

const mockHederaAnonCredsRegistry = {
  getSchema: vi.fn().mockResolvedValue('schema'),
  registerSchema: vi.fn().mockResolvedValue('registerSchema'),
  getCredentialDefinition: vi.fn().mockResolvedValue('credDef'),
  registerCredentialDefinition: vi.fn().mockResolvedValue('registerCredDef'),
  getRevocationRegistryDefinition: vi.fn().mockResolvedValue('revRegDef'),
  registerRevocationRegistryDefinition: vi.fn().mockResolvedValue('registerRevRegDef'),
  getRevocationStatusList: vi.fn().mockResolvedValue('revStatusList'),
  registerRevocationStatusList: vi.fn().mockResolvedValue('registerRevStatus'),
} as unknown as HederaAnonCredsRegistry

describe('HederaLedgerService', () => {
  const service = new HederaLedgerService({
    options: {
      networks: [
        {
          network: 'testnet',
          operatorId: 'mock-operator-id',
          operatorKey: 'mock-operator-key',
        },
      ],
      cache: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn(),
      },
    },
  })
  const builder: DIDUpdateBuilder = new DIDUpdateBuilder()

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  jest.spyOn((service as any).clientService, 'withClient').mockImplementation(async (_props, operation) => {
    const mockClient = {} as Client
    // @ts-ignore
    return operation(mockClient)
  })

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  jest.spyOn(service as any, 'getHederaAnonCredsRegistry').mockReturnValue(mockHederaAnonCredsRegistry)

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  jest.spyOn(service as any, 'getPublisher').mockResolvedValue({})

  describe('resolveDid', () =>
    it('should call resolveDID with proper args and returns result', async () => {
      // @ts-ignore - there is a conflict with 'resolveDID' "overloaded" signatures
      mockFunction(resolveDID).mockResolvedValueOnce(didDocument)

      const result = await service.resolveDid(mockAgentContext, did)

      expect(resolveDID).toHaveBeenCalledWith(
        did,
        'application/ld+json;profile="https://w3id.org/did-resolution"',
        expect.any(Object)
      )
      expect(result).toBe(didDocument)
    }))

  describe('createDid', () => {
    it('should create DID without didDocument', async () => {
      const createDidRequest = {
        state: {},
        signingRequest: { serializedPayload: new Uint8Array() },
      } as unknown as CreateDIDRequest

      mockFunction(generateCreateDIDRequest).mockResolvedValueOnce(createDidRequest)
      mockFunction(submitCreateDIDRequest).mockResolvedValueOnce({ did, didDocument })

      const result = await service.createDid(mockAgentContext, {
        method: 'hedera',
        options: { network: 'testnet' },
        secret: { rootKeyId: mockKeyId, keys: [] },
      })

      expect(mockKms.getPublicKey).toHaveBeenCalledWith({ keyId: mockKeyId })
      expect(generateCreateDIDRequest).toHaveBeenCalled()
      expect(submitCreateDIDRequest).toHaveBeenCalled()
      expect(result.did).toBe(did)
      expect(result.rootKey).toBeDefined()
    })

    it('should create DID with didDocument and calls updateDid', async () => {
      const createDidRequest = {
        state: {},
        signingRequest: { serializedPayload: new Uint8Array() },
      } as unknown as CreateDIDRequest

      mockFunction(generateCreateDIDRequest).mockResolvedValueOnce(createDidRequest)
      mockFunction(submitCreateDIDRequest).mockResolvedValueOnce({ did, didDocument })

      const updateDidSpy = jest.spyOn(service, 'updateDid').mockResolvedValueOnce({ did, didDocument })

      const result = await service.createDid(mockAgentContext, {
        method: 'hedera',
        options: { network: 'testnet' },
        secret: { rootKeyId: mockKeyId, keys: [] },
        didDocument: DidDocument.fromJSON(didDocument),
      })

      expect(updateDidSpy).toHaveBeenCalled()
      expect(result.rootKey).toBeDefined()
    })
  })

  describe('updateDid', () => {
    it('should throw error if didDocumentOperation is missing', async () => {
      await expect(service.updateDid(mockAgentContext, { did, didDocument })).rejects.toThrow(
        'DidDocumentOperation is required'
      )
    })

    it('should throw error if rootKey missing', async () => {
      const keys: DidDocumentKey[] = []
      await expect(
        service.updateDid(mockAgentContext, {
          did,
          didDocumentOperation: 'setDidDocument',
          secret: { keys },
          didDocument: {},
        })
      ).rejects.toThrow('The root key not found in the KMS')
    })

    it('should call correct builder methods for each field and action', () => {
      const spies = {
        addService: jest.spyOn(builder, 'addService'),
        removeService: jest.spyOn(builder, 'removeService'),
        addVerificationMethod: jest.spyOn(builder, 'addVerificationMethod'),
        removeVerificationMethod: jest.spyOn(builder, 'removeVerificationMethod'),
        addAssertionMethod: jest.spyOn(builder, 'addAssertionMethod'),
        removeAssertionMethod: jest.spyOn(builder, 'removeAssertionMethod'),
        addAuthenticationMethod: jest.spyOn(builder, 'addAuthenticationMethod'),
        removeAuthenticationMethod: jest.spyOn(builder, 'removeAuthenticationMethod'),
        addCapabilityDelegationMethod: jest.spyOn(builder, 'addCapabilityDelegationMethod'),
        removeCapabilityDelegationMethod: jest.spyOn(builder, 'removeCapabilityDelegationMethod'),
        addCapabilityInvocationMethod: jest.spyOn(builder, 'addCapabilityInvocationMethod'),
        removeCapabilityInvocationMethod: jest.spyOn(builder, 'removeCapabilityInvocationMethod'),
        addKeyAgreementMethod: jest.spyOn(builder, 'addKeyAgreementMethod'),
        removeKeyAgreementMethod: jest.spyOn(builder, 'removeKeyAgreementMethod'),
      }

      const testCases: [string, 'add' | 'remove', string, jest.SpyInstance][] = [
        ['service', 'add', 'service-item', spies.addService],
        ['service', 'remove', 'service-id', spies.removeService],

        ['verificationMethod', 'add', 'verificationMethod-item', spies.addVerificationMethod],
        ['verificationMethod', 'remove', 'verificationMethod-id', spies.removeVerificationMethod],

        ['assertionMethod', 'add', 'assertionMethod-item', spies.addAssertionMethod],
        ['assertionMethod', 'remove', 'assertionMethod-id', spies.removeAssertionMethod],

        ['authentication', 'add', 'authentication-item', spies.addAuthenticationMethod],
        ['authentication', 'remove', 'authentication-id', spies.removeAuthenticationMethod],

        ['capabilityDelegation', 'add', 'capabilityDelegation-item', spies.addCapabilityDelegationMethod],
        ['capabilityDelegation', 'remove', 'capabilityDelegation-id', spies.removeCapabilityDelegationMethod],

        ['capabilityInvocation', 'add', 'capabilityInvocation-item', spies.addCapabilityInvocationMethod],
        ['capabilityInvocation', 'remove', 'capabilityInvocation-id', spies.removeCapabilityInvocationMethod],

        ['keyAgreement', 'add', 'keyAgreement-item', spies.addKeyAgreementMethod],
        ['keyAgreement', 'remove', 'keyAgreement-id', spies.removeKeyAgreementMethod],
      ]

      for (const [property, action, param, spy] of testCases) {
        jest.clearAllMocks()

        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        const builderMethod = (service as any).getUpdateMethod(builder, property, action)

        const result = builderMethod(param)

        expect(result).toBe(builder)
        expect(spy).toHaveBeenCalledTimes(1)
        expect(spy).toHaveBeenCalledWith(param)
        for (const otherSpy of Object.values(spies)) {
          if (otherSpy !== spy) expect(otherSpy).not.toHaveBeenCalled()
        }
      }
    })

    it('should return builder unchanged for unknown property', () => {
      const unknownProperty = 'unknown-property'

      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const builderMethod = (service as any).getUpdateMethod(builder, unknownProperty, 'add')
      const result = builderMethod({})

      expect(result).toBe(builder)
    })

    it('should perform update flow successfully', async () => {
      const keys: DidDocumentKey[] = [
        { kmsKeyId: mockKeyId, didDocumentRelativeKeyId: DID_ROOT_KEY_ID },
        { kmsKeyId: 'some-key', didDocumentRelativeKeyId: '#abc' },
      ]

      const updatedDidDocument = {
        ...didDocument,
        verificationMethod: [
          ...didDocument.verificationMethod,
          {
            id: '#abc',
            type: 'Ed25519VerificationKey2020' as const,
            controller: 'test',
            publicKeyMultibase: 'mock-public-key-multibase',
          },
        ],
      }

      const updateDidRequest = {
        state: {},
        signingRequest: { serializedPayload: new Uint8Array() },
      } as unknown as UpdateDIDRequest

      // @ts-ignore - there is a conflict with 'resolveDID' "overloaded" signatures
      mockFunction(resolveDID).mockResolvedValueOnce({ didDocument })

      jest
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        .spyOn(service as any, 'prepareDidUpdates')
        .mockReturnValueOnce({ build: vi.fn().mockReturnValueOnce(updatedDidDocument) })

      mockFunction(generateUpdateDIDRequest).mockResolvedValueOnce(updateDidRequest)

      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      jest.spyOn(service as any, 'signRequests').mockResolvedValueOnce(Promise.resolve())
      mockFunction(submitUpdateDIDRequest).mockResolvedValueOnce({ did, didDocument: updatedDidDocument })

      await expect(
        service.updateDid(mockAgentContext, {
          did,
          didDocumentOperation: 'setDidDocument',
          didDocument: updatedDidDocument,
          secret: { keys },
        })
      ).resolves.toHaveProperty('did', did)

      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      expect((service as any).prepareDidUpdates).toHaveBeenCalled()
      expect(generateUpdateDIDRequest).toHaveBeenCalled()
      expect(submitUpdateDIDRequest).toHaveBeenCalled()
    })
  })

  describe('deactivateDid', () => {
    it('should throw error if rootKey is missing', async () => {
      await expect(service.deactivateDid(mockAgentContext, { did, secret: { keys: [] } })).rejects.toThrow(
        'The root key not found in the KMS'
      )
    })

    it('should throw an error if root key is not found in deactivateDid', async () => {
      mockFunction(mockAgentContext.dependencyManager.resolve).mockReturnValueOnce({ sign: vi.fn() })

      await expect(
        service.deactivateDid(mockAgentContext, {
          did,
          secret: {
            keys: [],
          },
        })
      ).rejects.toThrow('The root key not found in the KMS')
    })

    it('should deactivate DID successfully', async () => {
      const deactivateDidRequest = {
        state: {},
        signingRequest: { serializedPayload: new Uint8Array() },
      } as unknown as DeactivateDIDRequest

      mockFunction(generateDeactivateDIDRequest).mockResolvedValueOnce(deactivateDidRequest)
      mockFunction(submitDeactivateDIDRequest).mockResolvedValueOnce({
        did,
        didDocument,
      })

      const result = await service.deactivateDid(mockAgentContext, {
        did,
        secret: { keys: [{ kmsKeyId: mockKeyId, didDocumentRelativeKeyId: DID_ROOT_KEY_ID }] },
      })

      expect(result).toHaveProperty('did', did)
      expect(mockKms.sign).toHaveBeenCalledWith({
        keyId: mockKeyId,
        data: deactivateDidRequest.signingRequest.serializedPayload,
        algorithm: 'EdDSA',
      })
    })
  })

  describe('anoncreds SDK methods', () => {
    it('getSchema', async () => {
      const result = await service.getSchema(mockAgentContext, 'schemaId')
      expect(mockHederaAnonCredsRegistry.getSchema).toHaveBeenCalledWith('schemaId')
      expect(result).toBe('schema')
    })

    it('registerSchema', async () => {
      const options: RegisterSchemaOptions = {
        schema: {
          issuerId: '',
          name: '',
          version: '',
          attrNames: [],
        },
        options: {},
      }
      const result = await service.registerSchema(mockAgentContext, options)
      expect(mockHederaAnonCredsRegistry.registerSchema).toHaveBeenCalledWith({
        ...options,
        issuerKeySigner: expect.anything(),
      })
      expect(result).toBe('registerSchema')
    })

    it('getCredentialDefinition', async () => {
      const result = await service.getCredentialDefinition(mockAgentContext, 'credDefId')
      expect(mockHederaAnonCredsRegistry.getCredentialDefinition).toHaveBeenCalledWith('credDefId')
      expect(result).toBe('credDef')
    })

    it('registerCredentialDefinition', async () => {
      const options: RegisterCredentialDefinitionOptions = {
        options: {
          supportRevocation: true,
        },
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
      }
      await service.registerCredentialDefinition(mockAgentContext, options)
      expect(mockHederaAnonCredsRegistry.registerCredentialDefinition).toHaveBeenCalledWith({
        ...options,
        issuerKeySigner: expect.anything(),
        options: {
          supportRevocation: true,
        },
      })
    })

    it('getRevocationRegistryDefinition', async () => {
      const result = await service.getRevocationRegistryDefinition(mockAgentContext, 'revRegDefId')
      expect(mockHederaAnonCredsRegistry.getRevocationRegistryDefinition).toHaveBeenCalledWith('revRegDefId')
      expect(result).toBe('revRegDef')
    })

    it('registerRevocationRegistryDefinition', async () => {
      const options: RegisterRevocationRegistryDefinitionOptions = {
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
        options: {},
      }
      const result = await service.registerRevocationRegistryDefinition(mockAgentContext, options)
      expect(mockHederaAnonCredsRegistry.registerRevocationRegistryDefinition).toHaveBeenCalledWith({
        ...options,
        issuerKeySigner: expect.anything(),
      })
      expect(result).toBe('registerRevRegDef')
    })

    it('getRevocationStatusList', async () => {
      const result = await service.getRevocationStatusList(mockAgentContext, 'revRegId', 12345)
      expect(mockHederaAnonCredsRegistry.getRevocationStatusList).toHaveBeenCalledWith('revRegId', 12345)
      expect(result).toBe('revStatusList')
    })

    it('registerRevocationStatusList', async () => {
      const options: RegisterRevocationStatusListOptions = {
        options: {},
        revocationStatusList: {
          revRegDefId: '',
          issuerId: '',
          revocationList: [],
          currentAccumulator: '',
        },
      }
      const result = await service.registerRevocationStatusList(mockAgentContext, options)
      expect(mockHederaAnonCredsRegistry.registerRevocationStatusList).toHaveBeenCalledWith({
        ...options,
        issuerKeySigner: expect.anything(),
      })
      expect(result).toBe('registerRevStatus')
    })
  })

  describe('getIssuerKeySigner', () => {
    it('should return Signer when rootKey exists', async () => {
      const didRecord = {
        keys: [{ didDocumentRelativeKeyId: DID_ROOT_KEY_ID, kmsKeyId: 'kms-key-id' }],
      } as unknown as DidRecord

      mockFunction(mockDidRepository.findCreatedDid).mockResolvedValueOnce(didRecord)

      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const result = await (service as any).getIssuerKeySigner(mockAgentContext, 'issuer-id')

      expect(mockDidRepository.findCreatedDid).toHaveBeenCalledWith(mockAgentContext, 'issuer-id')
      // @ts-ignore
      expect(mockKms.getPublicKey).toHaveBeenCalledWith({ keyId: 'kms-key-id' })
      expect(await result.publicKey()).toEqual(privateKey.publicKey.toStringDer())
    })

    it('should throw error if no rootKey found', async () => {
      const didRecord = {
        keys: [],
      } as unknown as DidRecord
      mockFunction(mockDidRepository.findCreatedDid).mockResolvedValueOnce(didRecord)

      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      await expect((service as any).getIssuerKeySigner(mockAgentContext, 'issuer-id')).rejects.toThrow(
        'The root key not found in the KMS'
      )
    })

    it('should throw error if didRecord is null or undefined', async () => {
      mockFunction(mockDidRepository.findCreatedDid).mockResolvedValueOnce(null)

      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      await expect((service as any).getIssuerKeySigner(mockAgentContext, 'issuer-id')).rejects.toThrow(
        'The root key not found in the KMS'
      )
    })
  })
})
