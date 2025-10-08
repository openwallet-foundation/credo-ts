import { AgentContext, DidDocumentKey, DidRecord, DidRepository } from '@credo-ts/core'

import { DidDocumentRole } from '@credo-ts/core'
import { mockFunction } from '../../../core/tests/helpers'
import { HederaDidRegistrar } from '../../src/dids/HederaDidRegistrar'
import { HederaDidUpdateOptions, HederaLedgerService } from '../../src/ledger/HederaLedgerService'
import { did, didDocument, didResolutionMetadata } from './fixtures/did-document'

const mockDidRepository = {
  save: vi.fn(),
  findCreatedDid: vi.fn(),
  update: vi.fn(),
} as unknown as DidRepository

const mockLedgerService = {
  createDid: vi.fn(),
  resolveDid: vi.fn(),
  updateDid: vi.fn(),
  deactivateDid: vi.fn(),
} as unknown as HederaLedgerService

const mockAgentContext = {
  dependencyManager: {
    resolve: vi.fn().mockImplementation((cls) => {
      if (cls === DidRepository) return mockDidRepository
      if (cls === HederaLedgerService) return mockLedgerService
    }),
  },
  config: {
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
    },
  },
} as unknown as AgentContext

describe('HederaDidRegistrar', () => {
  const registrar: HederaDidRegistrar = new HederaDidRegistrar()

  describe('create', () => {
    it('should create DID, save it, and return finished state on success', async () => {
      const rootKey = { kmsKeyId: 'key1', didDocumentRelativeKeyId: 'rootKeyId' }

      mockFunction(mockLedgerService.createDid).mockResolvedValue({
        did,
        didDocument,
        rootKey,
      })

      const result = await registrar.create(mockAgentContext, {
        method: 'hedera',
        options: {},
      })

      expect(mockDidRepository.save).toHaveBeenCalled()
      const savedRecord = mockFunction(mockDidRepository.save).mock.calls[0][1]
      expect(savedRecord.did).toBe(did)
      expect(savedRecord.role).toBe(DidDocumentRole.Created)
      expect(savedRecord.didDocument).toBeInstanceOf(Object)
      expect(savedRecord.didDocument?.service).toBeDefined()
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      expect(savedRecord.didDocument?.service![0]).toBeInstanceOf(Object)

      expect(result.didState.state).toBe('finished')
      expect(result.didState.did).toBe(did)
      expect(result.didState.didDocument).toBeInstanceOf(Object)
    })

    it('should handle error and return failed state', async () => {
      mockFunction(mockLedgerService.createDid).mockRejectedValue(new Error('Create failed'))

      const result = await registrar.create(mockAgentContext, {
        method: 'hedera',
        options: {},
      })

      expect(mockAgentContext.config.logger.debug).toHaveBeenCalledWith('Error creating DID', expect.any(Object))

      expect(result.didState.state).toBe('failed')
      if (result.didState.state === 'failed')
        expect(result.didState.reason).toBe('Unable to register Did: Create failed')
    })
  })

  describe('update', () => {
    it('should update DID and save record successfully', async () => {
      const updatedDidDocument = {
        ...didDocument,
        service: [
          ...didDocument.service,
          { id: 'added-service', type: 'MockService', serviceEndpoint: 'https://example.com/added-service/' },
        ],
      }

      const foundDidRecord = {
        didDocument,
        keys: [{ didDocumentRelativeKeyId: 'key1' }],
      } as unknown as DidRecord

      mockFunction(mockLedgerService.resolveDid).mockResolvedValue({
        didDocument,
        didDocumentMetadata: { deactivated: false },
        didResolutionMetadata,
      })
      mockFunction(mockDidRepository.findCreatedDid).mockResolvedValue(foundDidRecord)
      mockFunction(mockLedgerService.updateDid).mockResolvedValue({ did, didDocument: updatedDidDocument })

      const options: HederaDidUpdateOptions = {
        did,
        didDocumentOperation: 'setDidDocument',
        secret: {
          keys: [
            {
              didDocumentRelativeKeyId: 'key2',
              kmsKeyId: 'some-key',
            },
          ],
        },
        didDocument: {},
      }

      const result = await registrar.update(mockAgentContext, options)

      expect(mockLedgerService.resolveDid).toHaveBeenCalledWith(mockAgentContext, did)
      expect(mockDidRepository.findCreatedDid).toHaveBeenCalledWith(mockAgentContext, did)

      expect(mockLedgerService.updateDid).toHaveBeenCalledWith(
        mockAgentContext,
        expect.objectContaining({
          secret: { keys: expect.any(Array) },
        })
      )

      expect(mockDidRepository.update).toHaveBeenCalledWith(mockAgentContext, foundDidRecord)

      expect(result.didState.state).toBe('finished')
      expect(result.didState.did).toBe(did)
      expect(result.didState.didDocument).toBeInstanceOf(Object)
    })

    it('should return failed state if DID not found or deactivated', async () => {
      mockFunction(mockLedgerService.resolveDid).mockResolvedValue({
        didDocument,
        didResolutionMetadata,
        didDocumentMetadata: { deactivated: true },
      })
      mockFunction(mockDidRepository.findCreatedDid).mockResolvedValue(null)

      const result = await registrar.update(mockAgentContext, {
        did,
        didDocument: {},
      })

      expect(result.didState.state).toBe('failed')
      if (result.didState.state === 'failed') expect(result.didState.reason).toBe('Did not found')
    })

    it('should handle error and return failed state', async () => {
      mockFunction(mockLedgerService.resolveDid).mockRejectedValue(new Error('Update failed'))

      const result = await registrar.update(mockAgentContext, {
        did,
        didDocumentOperation: 'setDidDocument',
        didDocument: {},
      })

      expect(mockAgentContext.config.logger.error).toHaveBeenCalledWith('Error updating DID', expect.any(Error))
      expect(result.didState.state).toBe('failed')
      if (result.didState.state === 'failed') expect(result.didState.reason).toBe('Unable update DID: Update failed')
    })
  })

  describe('deactivate', () => {
    it('should deactivate DID and save updated record successfully', async () => {
      const deactivatedDidDocument = { ...didDocument, deactivated: true }

      const foundDidRecord = {
        didDocument,
        keys: [{ didDocumentRelativeKeyId: 'key1' }],
      } as unknown as DidRecord

      mockFunction(mockLedgerService.resolveDid).mockResolvedValue({
        didDocument,
        didResolutionMetadata,
        didDocumentMetadata: {},
      })
      mockFunction(mockDidRepository.findCreatedDid).mockResolvedValue(foundDidRecord)
      mockFunction(mockLedgerService.deactivateDid).mockResolvedValue({
        did,
        didDocument: deactivatedDidDocument,
      })
      mockFunction(mockDidRepository.update).mockResolvedValue(undefined)

      const result = await registrar.deactivate(mockAgentContext, {
        did,
      })

      expect(mockLedgerService.resolveDid).toHaveBeenCalledWith(mockAgentContext, did)
      expect(mockDidRepository.findCreatedDid).toHaveBeenCalledWith(mockAgentContext, did)
      expect(mockLedgerService.deactivateDid).toHaveBeenCalledWith(
        mockAgentContext,
        expect.objectContaining({
          secret: { keys: foundDidRecord.keys },
        })
      )
      expect(mockDidRepository.update).toHaveBeenCalledWith(mockAgentContext, foundDidRecord)

      expect(result.didState.state).toBe('finished')
      expect(result.didState.did).toBe(did)
      expect(result.didState.didDocument).toBeInstanceOf(Object)
    })

    it('should return failed state if DID is deactivated', async () => {
      mockFunction(mockLedgerService.resolveDid).mockResolvedValueOnce({
        didDocument,
        didResolutionMetadata,
        didDocumentMetadata: { deactivated: true },
      })
      mockFunction(mockDidRepository.findCreatedDid).mockResolvedValue(null)

      const result = await registrar.deactivate(mockAgentContext, {
        did,
      })

      expect(result.didState.state).toBe('failed')
      // @ts-ignore
      expect(result.didState.reason).toBe('Did not found')
    })

    it('should handle error and return failed state', async () => {
      mockFunction(mockLedgerService.resolveDid).mockRejectedValue(new Error('Deactivate failed'))

      const result = await registrar.deactivate(mockAgentContext, { did })

      expect(mockAgentContext.config.logger.error).toHaveBeenCalledWith('Error deactivating DID', expect.any(Error))
      expect(result.didState.state).toBe('failed')
      if (result.didState.state === 'failed')
        expect(result.didState.reason).toBe('Unable deactivating DID: Deactivate failed')
    })
  })

  describe('concatKeys (private method)', () => {
    it('should concatenate keys without duplicates based on relativeKeyId', () => {
      const keys1 = [{ didDocumentRelativeKeyId: 'key1' }, { didDocumentRelativeKeyId: 'key2' }] as DidDocumentKey[]
      const keys2 = [{ didDocumentRelativeKeyId: 'key2' }, { didDocumentRelativeKeyId: 'key3' }] as DidDocumentKey[]

      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const result = (registrar as any).concatKeys(keys1, keys2)

      expect(result).toHaveLength(3)
      expect(result).toEqual(
        expect.arrayContaining([
          { didDocumentRelativeKeyId: 'key1' },
          { didDocumentRelativeKeyId: 'key2' },
          { didDocumentRelativeKeyId: 'key3' },
        ])
      )
    })

    it('should handle undefined arguments and return empty array', () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const result = (registrar as any).concatKeys(undefined, undefined)
      expect(result).toEqual([])
    })
  })
})
