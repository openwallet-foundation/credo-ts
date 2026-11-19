import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../tests/helpers'
import { KeyManagementApi } from '../../../kms'
import { DidsModuleConfig } from '../../DidsModuleConfig'
import type { DidDocument, DidRegistrar } from '../../domain'
import { DidRegistrarService } from '../DidRegistrarService'
import type { DidResolverService } from '../DidResolverService'

const agentConfig = getAgentConfig('DidResolverService')
const agentContext = getAgentContext()

const didRegistrarMock = {
  supportedMethods: ['key'],
  deactivationSupport: 'supported',
  create: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
} as Required<DidRegistrar>

const didResolverMock = {
  invalidateCacheForDid: vi.fn(),
} as unknown as DidResolverService

const didRegistrarService = new DidRegistrarService(
  agentConfig.logger,
  new DidsModuleConfig({
    registrars: [didRegistrarMock],
  }),
  didResolverMock
)

describe('DidResolverService', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('should correctly find and call the correct registrar for a specified did', async () => {
      const returnValue = {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: ':(',
        },
      } as const
      mockFunction(didRegistrarMock.create).mockResolvedValue(returnValue)

      const result = await didRegistrarService.create(agentContext, { did: 'did:key:xxxx' })
      expect(result).toEqual(returnValue)

      expect(didRegistrarMock.create).toHaveBeenCalledTimes(1)
      expect(didRegistrarMock.create).toHaveBeenCalledWith(agentContext, { did: 'did:key:xxxx' })
    })

    it('should return error state failed if no did or method is provided', async () => {
      const result = await didRegistrarService.create(agentContext, {})

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          did: undefined,
          reason: 'Either did OR method must be specified',
        },
      })
    })

    it('should return error state failed if both did and method are provided', async () => {
      const result = await didRegistrarService.create(agentContext, { did: 'did:key:xxxx', method: 'key' })

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          did: 'did:key:xxxx',
          reason: 'Either did OR method must be specified',
        },
      })
    })

    it('should return error state failed if no method could be extracted from the did or method', async () => {
      const result = await didRegistrarService.create(agentContext, { did: 'did:a' })

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          did: 'did:a',
          reason: 'Could not extract method from did did:a',
        },
      })
    })

    it('should return error with state failed if the did has no registrar', async () => {
      const result = await didRegistrarService.create(agentContext, { did: 'did:something:123' })

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          did: 'did:something:123',
          reason: "Unsupported did method: 'something'",
        },
      })
    })
  })

  describe('update', () => {
    it('should correctly find and call the correct registrar for a specified did', async () => {
      const returnValue = {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: ':(',
        },
      } as const
      mockFunction(didRegistrarMock.update).mockResolvedValue(returnValue)

      const didDocument = {} as unknown as DidDocument

      const result = await didRegistrarService.update(agentContext, { did: 'did:key:xxxx', didDocument })
      expect(result).toEqual(returnValue)

      expect(didResolverMock.invalidateCacheForDid).toHaveBeenCalledTimes(1)
      expect(didRegistrarMock.update).toHaveBeenCalledTimes(1)
      expect(didRegistrarMock.update).toHaveBeenCalledWith(agentContext, { did: 'did:key:xxxx', didDocument })
    })

    it('should return error state failed if no method could be extracted from the did', async () => {
      const result = await didRegistrarService.update(agentContext, { did: 'did:a', didDocument: {} as DidDocument })

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          did: 'did:a',
          reason: 'Could not extract method from did did:a',
        },
      })
    })

    it('should return error with state failed if the did has no registrar', async () => {
      const result = await didRegistrarService.update(agentContext, {
        did: 'did:something:123',
        didDocument: {} as DidDocument,
      })

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          did: 'did:something:123',
          reason: "Unsupported did method: 'something'",
        },
      })
    })
  })

  describe('update with deleteRemovedKeys', () => {
    const kms = agentContext.resolve(KeyManagementApi)
    const finished = {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: { state: 'finished', did: 'did:key:xxxx', didDocument: {} as DidDocument },
    } as const

    it('deletes the removed keys the registrar returns, and continues when a delete fails', async () => {
      const [removedKey1, removedKey2] = await Promise.all(
        [0, 1].map(() => kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } }))
      )
      const removedKeys = [removedKey1, removedKey2].map(({ keyId }) => ({ keyId }))
      mockFunction(didRegistrarMock.update).mockResolvedValue({ ...finished, removedKeys })
      const deleteKey = vi.spyOn(kms, 'deleteKey').mockRejectedValueOnce(new Error('delete failed'))

      const result = await didRegistrarService.update(agentContext, {
        did: 'did:key:xxxx',
        didDocument: {},
        deleteRemovedKeys: true,
      })

      expect(result).toEqual({ ...finished, removedKeys })
      expect(deleteKey.mock.calls).toEqual([
        [{ keyId: removedKey1.keyId, backend: undefined }],
        [{ keyId: removedKey2.keyId, backend: undefined }],
      ])
      await expect(kms.getPublicKey({ keyId: removedKey2.keyId })).rejects.toThrow('not found')
    })

    it('keeps the keys when the update did not finish', async () => {
      mockFunction(didRegistrarMock.update).mockResolvedValue({
        ...finished,
        didState: { state: 'failed', reason: ':(' },
        removedKeys: [{ keyId: 'key-1' }],
      })
      const deleteKey = vi.spyOn(kms, 'deleteKey')

      await didRegistrarService.update(agentContext, {
        did: 'did:key:xxxx',
        didDocument: {},
        deleteRemovedKeys: true,
      })

      expect(deleteKey).not.toHaveBeenCalled()
    })
  })

  describe('deactivate', () => {
    it('should correctly find and call the correct registrar for a specified did', async () => {
      const returnValue = {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: ':(',
        },
      } as const
      mockFunction(didRegistrarMock.deactivate).mockResolvedValue(returnValue)

      const result = await didRegistrarService.deactivate(agentContext, { did: 'did:key:xxxx' })
      expect(result).toEqual(returnValue)

      expect(didResolverMock.invalidateCacheForDid).toHaveBeenCalledTimes(1)
      expect(didRegistrarMock.deactivate).toHaveBeenCalledTimes(1)
      expect(didRegistrarMock.deactivate).toHaveBeenCalledWith(agentContext, { did: 'did:key:xxxx' })
    })

    it('should return error state failed if no method could be extracted from the did', async () => {
      const result = await didRegistrarService.deactivate(agentContext, { did: 'did:a' })

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          did: 'did:a',
          reason: 'Could not extract method from did did:a',
        },
      })
    })

    it('should return error with state failed if the did has no registrar', async () => {
      const result = await didRegistrarService.deactivate(agentContext, { did: 'did:something:123' })

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          did: 'did:something:123',
          reason: "Unsupported did method: 'something'",
        },
      })
    })

    it('should return error with state failed if the registrar does not implement deactivate', async () => {
      const registrarService = new DidRegistrarService(
        agentConfig.logger,
        new DidsModuleConfig({
          registrars: [{ ...didRegistrarMock, deactivationSupport: 'notSupportedByRegistrar', deactivate: undefined }],
        }),
        didResolverMock
      )

      const result = await registrarService.deactivate(agentContext, { did: 'did:key:xxxx' })

      expect(result.didState).toEqual({
        state: 'failed',
        did: 'did:key:xxxx',
        reason: "notSupported: registrar for did method 'key' doesn't support deactivation",
      })
    })
  })

  describe('getDeactivationSupport', () => {
    it('should return the deactivation support of the registrar of the did', () => {
      expect(didRegistrarService.getDeactivationSupport('did:key:123')).toBe('supported')
      expect(didRegistrarService.getDeactivationSupport('did:something:123')).toBe('notSupportedByRegistrar')
      expect(didRegistrarService.getDeactivationSupport('invalid')).toBe('notSupportedByRegistrar')
    })
  })
})
