import { AgentContext, DidDocument, JsonTransformer } from '@credo-ts/core'
import { mockFunction } from '../../../core/tests/helpers'
import { HederaDidResolver } from '../../src/dids/HederaDidResolver'
import { HederaLedgerService } from '../../src/ledger/HederaLedgerService'
import { did, didDocument, didResolutionMetadata, parsedDid } from './fixtures/did-document'

const mockLedgerService = {
  resolveDid: vi.fn(),
} as unknown as HederaLedgerService

const mockAgentContext = {
  config: {
    logger: {
      trace: vi.fn(),
      debug: vi.fn(),
    },
  },
  dependencyManager: {
    resolve: vi.fn().mockImplementation((cls) => {
      if (cls === HederaLedgerService) return mockLedgerService
    }),
  },
} as unknown as AgentContext

const resolver = new HederaDidResolver()

describe('HederaDidResolver', () => {
  it('should successfully resolve DID', async () => {
    const resolutionResult = {
      didDocument,
      didDocumentMetadata: {},
      didResolutionMetadata,
    }

    mockFunction(mockLedgerService.resolveDid).mockResolvedValue(resolutionResult)

    jest.spyOn(JsonTransformer, 'fromJSON').mockReturnValue(didDocument)

    const result = await resolver.resolve(mockAgentContext, did, parsedDid, {})

    expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith('Try to resolve a did document from ledger')
    expect(mockAgentContext.dependencyManager.resolve).toHaveBeenCalledWith(HederaLedgerService)
    expect(mockLedgerService.resolveDid).toHaveBeenCalledWith(mockAgentContext, did)
    expect(JsonTransformer.fromJSON).toHaveBeenCalledWith(resolutionResult.didDocument, DidDocument)
    expect(result).toEqual(resolutionResult)
  })

  it('should handle error and return notFound', async () => {
    const error = new Error('Some error')

    mockFunction(mockLedgerService.resolveDid).mockRejectedValue(error)

    const result = await resolver.resolve(mockAgentContext, did, parsedDid, {})

    expect(mockAgentContext.config.logger.trace).toHaveBeenCalledWith('Try to resolve a did document from ledger')
    expect(mockAgentContext.config.logger.debug).toHaveBeenCalledWith('Error resolving the did', {
      error,
      did,
    })

    expect(result).toEqual({
      didDocument: null,
      didDocumentMetadata: {},
      didResolutionMetadata: {
        error: 'notFound',
        message: `Unable to resolve did '${did}': ${error}`,
      },
    })
  })
})
