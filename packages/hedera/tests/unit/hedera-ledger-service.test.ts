import type { HederaAnonCredsRegistry } from '../../src/anoncreds/HederaAnonCredsRegistry'
import type {
  RegisterCredentialDefinitionOptions,
  RegisterRevocationRegistryDefinitionOptions,
  RegisterRevocationStatusListOptions,
  RegisterSchemaOptions,
} from '@credo-ts/anoncreds'
import type { AgentContext, DidRecord } from '@credo-ts/core'
import type { Client } from '@hashgraph/sdk'
import type { CreateDIDRequest, DeactivateDIDRequest, UpdateDIDRequest } from '@hiero-did-sdk/registrar'

import { Buffer, DidDocument, DidDocumentService, DidRepository, Key, KeyType } from '@credo-ts/core'
import { PrivateKey } from '@hashgraph/sdk'
import {
  DIDUpdateBuilder,
  generateCreateDIDRequest,
  generateDeactivateDIDRequest,
  generateUpdateDIDRequest,
  submitCreateDIDRequest,
  submitDeactivateDIDRequest,
  submitUpdateDIDRequest,
} from '@hiero-did-sdk/registrar'
import { resolveDID } from '@hiero-did-sdk/resolver'

import { mockFunction } from '../../../core/tests/helpers'
import { HederaLedgerService } from '../../src/ledger/HederaLedgerService'

import { did, didDocument as didDocumentFixture } from './fixtures/did-document'

jest.mock('@hiero-did-sdk/registrar', () => ({
  DIDUpdateBuilder: jest.fn().mockReturnValue({
    addService: jest.fn().mockReturnThis(),
    removeService: jest.fn().mockReturnThis(),
    addVerificationMethod: jest.fn().mockReturnThis(),
    removeVerificationMethod: jest.fn().mockReturnThis(),
    addAssertionMethod: jest.fn().mockReturnThis(),
    removeAssertionMethod: jest.fn().mockReturnThis(),
    addAuthenticationMethod: jest.fn().mockReturnThis(),
    removeAuthenticationMethod: jest.fn().mockReturnThis(),
    addCapabilityDelegationMethod: jest.fn().mockReturnThis(),
    removeCapabilityDelegationMethod: jest.fn().mockReturnThis(),
    addCapabilityInvocationMethod: jest.fn().mockReturnThis(),
    removeCapabilityInvocationMethod: jest.fn().mockReturnThis(),
    addKeyAgreementMethod: jest.fn().mockReturnThis(),
    removeKeyAgreementMethod: jest.fn().mockReturnThis(),
    build: jest.fn(),
  }),
  generateCreateDIDRequest: jest.fn(),
  submitCreateDIDRequest: jest.fn(),
  generateUpdateDIDRequest: jest.fn(),
  submitUpdateDIDRequest: jest.fn(),
  generateDeactivateDIDRequest: jest.fn(),
  submitDeactivateDIDRequest: jest.fn(),
}))

jest.mock('@hiero-did-sdk/resolver', () => ({
  resolveDID: jest.fn(),
  TopicReaderHederaHcs: jest.fn(),
}))

const hederaPrivateKey = PrivateKey.generateED25519()
const publicKey: Key = Key.fromPublicKey(hederaPrivateKey.publicKey.toBytesRaw(), KeyType.Ed25519)

const didDocument = {
  ...didDocumentFixture,
  verificationMethod: [
    {
      id: `${did}#did-root-key`,
      controller: did,
      type: 'Ed25519VerificationKey2020' as const,
      publicKeyMultibase: publicKey.fingerprint,
    },
  ],
}

const credoDidDocument = new DidDocument({
  ...didDocument,
  service: didDocument.service.map((s) => new DidDocumentService(s)),
})

const mockDidRepository = {
  findCreatedDid: jest.fn().mockResolvedValue({ did, didDocument: credoDidDocument }),
} as unknown as DidRepository

const mockAgentContext = {
  dependencyManager: {
    resolve: jest.fn((cls) => {
      if (cls === DidRepository) {
        return mockDidRepository
      }
      throw new Error(`No instance found for ${cls}`)
    }),
  },
  wallet: {
    createKey: jest.fn().mockResolvedValue(publicKey),
    sign: jest.fn(),
  },
} as unknown as AgentContext

const mockHederaAnonCredsRegistry = {
  getSchema: jest.fn().mockResolvedValue('schema'),
  registerSchema: jest.fn().mockResolvedValue('registerSchema'),
  getCredentialDefinition: jest.fn().mockResolvedValue('credDef'),
  registerCredentialDefinition: jest.fn().mockResolvedValue('registerCredDef'),
  getRevocationRegistryDefinition: jest.fn().mockResolvedValue('revRegDef'),
  registerRevocationRegistryDefinition: jest.fn().mockResolvedValue('registerRevRegDef'),
  getRevocationStatusList: jest.fn().mockResolvedValue('revStatusList'),
  registerRevocationStatusList: jest.fn().mockResolvedValue('registerRevStatus'),
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
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
        clear: jest.fn(),
      },
    },
  })
  const builder: DIDUpdateBuilder = new DIDUpdateBuilder()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jest.spyOn((service as any).clientService, 'withClient').mockImplementation(async (_props, operation) => {
    const mockClient = {} as Client
    // @ts-ignore
    return operation(mockClient)
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jest.spyOn(service as any, 'getHederaAnonCredsRegistry').mockReturnValue(mockHederaAnonCredsRegistry)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      })

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
        didDocument: credoDidDocument,
      })

      expect(updateDidSpy).toHaveBeenCalled()
      expect(result.rootKey).toBeDefined()
    })
  })

  describe('updateDid', () => {
    it('should throw error if didDocumentOperation is missing', async () => {
      await expect(service.updateDid(mockAgentContext, { did, didDocument: credoDidDocument })).rejects.toThrow(
        'DidDocumentOperation is required'
      )
    })

    it('should throw error if rootKey missing', async () => {
      // @ts-ignore - there is a conflict with 'resolveDID' "overloaded" signatures
      mockFunction(resolveDID).mockResolvedValueOnce({ didDocument: { ...didDocument, verificationMethod: [] } })

      await expect(
        service.updateDid(mockAgentContext, {
          did,
          didDocumentOperation: 'setDidDocument',
          didDocument: {},
        })
      ).rejects.toThrow('The root key is not found in DID document')
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builderMethod = (service as any).getUpdateMethod(builder, unknownProperty, 'add')
      const result = builderMethod({})

      expect(result).toBe(builder)
    })

    it('should perform update flow successfully', async () => {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(service as any, 'prepareDidUpdates')
        .mockReturnValueOnce({ build: jest.fn().mockReturnValueOnce(updatedDidDocument) })

      mockFunction(generateUpdateDIDRequest).mockResolvedValueOnce(updateDidRequest)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, 'signRequests').mockResolvedValueOnce(Promise.resolve())
      mockFunction(submitUpdateDIDRequest).mockResolvedValueOnce({ did, didDocument: updatedDidDocument })

      await expect(
        service.updateDid(mockAgentContext, {
          did,
          didDocumentOperation: 'setDidDocument',
          didDocument: new DidDocument({
            ...updatedDidDocument,
            service: updatedDidDocument.service.map((s) => new DidDocumentService(s)),
          }),
        })
      ).resolves.toHaveProperty('did', did)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((service as any).prepareDidUpdates).toHaveBeenCalled()
      expect(generateUpdateDIDRequest).toHaveBeenCalled()
      expect(submitUpdateDIDRequest).toHaveBeenCalled()
    })
  })

  describe('deactivateDid', () => {
    it('should throw an error if root key is not found in deactivateDid', async () => {
      const didRecord = {
        didDocument: { ...credoDidDocument, verificationMethod: [] },
      } as unknown as DidRecord
      mockFunction(mockDidRepository.findCreatedDid).mockResolvedValueOnce(didRecord)

      await expect(
        service.deactivateDid(mockAgentContext, {
          did,
        })
      ).rejects.toThrow('The root key is not found in DID document')
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
      })

      expect(result).toHaveProperty('did', did)
      expect(mockAgentContext.wallet.sign).toHaveBeenCalledWith({
        key: publicKey,
        data: Buffer.from(deactivateDidRequest.signingRequest.serializedPayload),
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).getIssuerKeySigner(mockAgentContext, 'issuer-id')

      expect(mockDidRepository.findCreatedDid).toHaveBeenCalledWith(mockAgentContext, 'issuer-id')
      expect(await result.publicKey()).toEqual(hederaPrivateKey.publicKey.toStringDer())
    })

    it('should throw error if no rootKey found', async () => {
      const didRecord = {
        didDocument: { ...credoDidDocument, verificationMethod: [] },
      } as unknown as DidRecord
      mockFunction(mockDidRepository.findCreatedDid).mockResolvedValueOnce(didRecord)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect((service as any).getIssuerKeySigner(mockAgentContext, 'issuer-id')).rejects.toThrow(
        'The root key is not found in DID document'
      )
    })

    it('should throw error if didRecord is null or undefined', async () => {
      mockFunction(mockDidRepository.findCreatedDid).mockResolvedValueOnce(null)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect((service as any).getIssuerKeySigner(mockAgentContext, 'issuer-id')).rejects.toThrow(
        'Created DID document for issuer-id is not found'
      )
    })
  })
})
