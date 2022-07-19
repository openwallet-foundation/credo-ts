import type { IndyLedgerService, IndyPoolService } from '../../../ledger'
import type { DidDocument } from '../../domain'
import type { DidRepository } from '../../repository'

import { agentDependencies, getAgentConfig, getAgentContext, mockProperty } from '../../../../../tests/helpers'
import { KeyDidRegistrar } from '../../methods/key/KeyDidRegistrar'
import { DidRegistrarService } from '../DidRegistrarService'

jest.mock('../../methods/key/KeyDidRegistrar')

const agentConfig = getAgentConfig('DidResolverService')
const agentContext = getAgentContext()

mockProperty(KeyDidRegistrar.prototype, 'supportedMethods', ['key'])

const indyLedgerServiceMock = jest.fn() as unknown as IndyLedgerService
const didDocumentRepositoryMock = jest.fn() as unknown as DidRepository
const indyPoolServiceMock = jest.fn() as unknown as IndyPoolService
const didResolverService = new DidRegistrarService(
  didDocumentRepositoryMock,
  indyLedgerServiceMock,
  indyPoolServiceMock,
  agentConfig.logger,
  agentDependencies
)

describe('DidResolverService', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('create', () => {
    it('should correctly find and call the correct registrar for a specified did', async () => {
      const didKeyCreateSpy = jest.spyOn(KeyDidRegistrar.prototype, 'create')

      const returnValue = {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: ':(',
        },
      } as const
      didKeyCreateSpy.mockResolvedValue(returnValue)

      const result = await didResolverService.create(agentContext, { did: 'did:key:xxxx' })
      expect(result).toEqual(returnValue)

      expect(didKeyCreateSpy).toHaveBeenCalledTimes(1)
      expect(didKeyCreateSpy).toHaveBeenCalledWith(agentContext, { did: 'did:key:xxxx' })
    })

    it('should return error state failed if no did or method is provided', async () => {
      const result = await didResolverService.create(agentContext, {})

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
      const result = await didResolverService.create(agentContext, { did: 'did:key:xxxx', method: 'key' })

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
      const result = await didResolverService.create(agentContext, { did: 'did:a' })

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
      const result = await didResolverService.create(agentContext, { did: 'did:something:123' })

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
      const didKeyUpdateSpy = jest.spyOn(KeyDidRegistrar.prototype, 'update')

      const returnValue = {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: ':(',
        },
      } as const
      didKeyUpdateSpy.mockResolvedValue(returnValue)

      const didDocument = {} as unknown as DidDocument

      const result = await didResolverService.update(agentContext, { did: 'did:key:xxxx', didDocument })
      expect(result).toEqual(returnValue)

      expect(didKeyUpdateSpy).toHaveBeenCalledTimes(1)
      expect(didKeyUpdateSpy).toHaveBeenCalledWith(agentContext, { did: 'did:key:xxxx', didDocument })
    })

    it('should return error state failed if no method could be extracted from the did', async () => {
      const result = await didResolverService.update(agentContext, { did: 'did:a', didDocument: {} as DidDocument })

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
      const result = await didResolverService.update(agentContext, {
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

  describe('deactivate', () => {
    it('should correctly find and call the correct registrar for a specified did', async () => {
      const didKeyDeactivateSpy = jest.spyOn(KeyDidRegistrar.prototype, 'deactivate')

      const returnValue = {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: ':(',
        },
      } as const
      didKeyDeactivateSpy.mockResolvedValue(returnValue)

      const result = await didResolverService.deactivate(agentContext, { did: 'did:key:xxxx' })
      expect(result).toEqual(returnValue)

      expect(didKeyDeactivateSpy).toHaveBeenCalledTimes(1)
      expect(didKeyDeactivateSpy).toHaveBeenCalledWith(agentContext, { did: 'did:key:xxxx' })
    })

    it('should return error state failed if no method could be extracted from the did', async () => {
      const result = await didResolverService.deactivate(agentContext, { did: 'did:a' })

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
      const result = await didResolverService.deactivate(agentContext, { did: 'did:something:123' })

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
})
