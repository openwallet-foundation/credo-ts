import { CacheModuleConfig, type EventEmitter, InMemoryLruCache, Kms, type StorageService } from '@credo-ts/core'

import { getAgentContext, mockFunction } from '../../../../core/tests/helpers'
import { TenantRoutingRecord } from '../TenantRoutingRecord'
import { TenantRoutingRepository } from '../TenantRoutingRepository'

const storageServiceMock = {
  findByQuery: vi.fn(),
} as unknown as StorageService<TenantRoutingRecord>
const eventEmitter = vi.fn() as unknown as EventEmitter
const agentContext = getAgentContext({
  registerInstances: [
    [
      CacheModuleConfig,
      new CacheModuleConfig({
        cache: new InMemoryLruCache({ limit: 500 }),
      }),
    ],
  ],
})

const tenantRoutingRepository = new TenantRoutingRepository(storageServiceMock, eventEmitter)

describe('TenantRoutingRepository', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('findByRecipientKey', () => {
    test('it should correctly transform the key to a fingerprint and return the routing record', async () => {
      const key = Kms.PublicJwk.fromFingerprint('z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL')
      const tenantRoutingRecord = new TenantRoutingRecord({
        recipientKeyFingerprint: key.fingerprint,
        tenantId: 'tenant-id',
      })

      mockFunction(storageServiceMock.findByQuery).mockResolvedValue([tenantRoutingRecord])
      const returnedRecord = await tenantRoutingRepository.findByRecipientKey(agentContext, key)

      expect(storageServiceMock.findByQuery).toHaveBeenCalledWith(
        agentContext,
        TenantRoutingRecord,
        {
          recipientKeyFingerprint: 'z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
        },
        undefined
      )
      expect(returnedRecord).toBe(tenantRoutingRecord)
    })
  })
})
