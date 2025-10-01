import { AgentContext, DidDocumentRole, DidRecord, DidRepository, DidUpdateOptions, Key, KeyType } from '@credo-ts/core'
import { mockFunction } from '../../../core/tests/helpers'
import { HederaDidRegistrar } from '../../src/dids/HederaDidRegistrar'
import { HederaLedgerService } from '../../src/ledger/HederaLedgerService'
import { did, didDocument, didResolutionMetadata } from './fixtures/did-document'
import { PrivateKey } from '@hashgraph/sdk'

const mockDidRepository = {
  save: jest.fn(),
  findCreatedDid: jest.fn(),
  update: jest.fn(),
} as unknown as DidRepository

const mockLedgerService = {
  createDid: jest.fn(),
  resolveDid: jest.fn(),
  updateDid: jest.fn(),
  deactivateDid: jest.fn(),
} as unknown as HederaLedgerService

const mockAgentContext = {
  dependencyManager: {
    resolve: jest.fn().mockImplementation((cls) => {
      if (cls === DidRepository) return mockDidRepository
      if (cls === HederaLedgerService) return mockLedgerService
    }),
  },
  config: {
    logger: {
      debug: jest.fn(),
      error: jest.fn(),
    },
  },
} as unknown as AgentContext

describe('HederaDidRegistrar', () => {
  const registrar: HederaDidRegistrar = new HederaDidRegistrar()

  describe('create', () => {
    it('should create DID, save it, and return finished state on success', async () => {
      const rootKey = await PrivateKey.generateED25519Async().then((result) =>
        Key.fromPublicKey(result.publicKey.toBytesRaw(), KeyType.Ed25519)
      )

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
      } as unknown as DidRecord

      mockFunction(mockLedgerService.resolveDid).mockResolvedValue({
        didDocument,
        didDocumentMetadata: { deactivated: false },
        didResolutionMetadata,
      })
      mockFunction(mockDidRepository.findCreatedDid).mockResolvedValue(foundDidRecord)
      mockFunction(mockLedgerService.updateDid).mockResolvedValue({ did, didDocument: updatedDidDocument })

      const options: DidUpdateOptions = {
        did,
        didDocumentOperation: 'setDidDocument',
        didDocument: {},
      }

      const result = await registrar.update(mockAgentContext, options)

      expect(mockLedgerService.resolveDid).toHaveBeenCalledWith(mockAgentContext, did)
      expect(mockDidRepository.findCreatedDid).toHaveBeenCalledWith(mockAgentContext, did)

      expect(mockLedgerService.updateDid).toHaveBeenCalledWith(mockAgentContext, options)

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
      expect(mockLedgerService.deactivateDid).toHaveBeenCalledWith(mockAgentContext, expect.objectContaining({ did }))
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
})
