import { CacheModuleConfig, InMemoryLruCache, Kms, SingleContextStorageLruCache } from '@credo-ts/core'
import type { MockedClassConstructor } from '../../../../../tests/types'
import { getAgentContext, mockFunction } from '../../../../core/tests/helpers'
import { TenantRecord, TenantRoutingRecord, TenantStatus } from '../../repository'
import { TenantRepository } from '../../repository/TenantRepository'
import { TenantRoutingRepository } from '../../repository/TenantRoutingRepository'
import { TenantsModuleConfig } from '../../TenantsModuleConfig'
import { TenantRecordService } from '../TenantRecordService'

vi.mock('../../repository/TenantRepository')
const TenantRepositoryMock = TenantRepository as MockedClassConstructor<typeof TenantRepository>
vi.mock('../../repository/TenantRoutingRepository')
const TenantRoutingRepositoryMock = TenantRoutingRepository as MockedClassConstructor<typeof TenantRoutingRepository>

const tenantRepository = new TenantRepositoryMock()
const tenantRoutingRepository = new TenantRoutingRepositoryMock()
const agentContext = getAgentContext({
  registerInstances: [[TenantsModuleConfig, new TenantsModuleConfig({ tenantRecordCache: false })]],
})

const tenantRecordService = new TenantRecordService(tenantRepository, tenantRoutingRepository)

describe('TenantRecordService', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getTenantByIdForSession', () => {
    const tenantRecord = new TenantRecord({ id: 'tenant-id', config: { label: 'Test Tenant' }, storageVersion: '0.5' })

    test('reads the tenant record from storage every time when the cache is disabled', async () => {
      mockFunction(tenantRepository.getById).mockResolvedValue(tenantRecord)

      await tenantRecordService.getTenantByIdForSession(agentContext, 'tenant-id')
      await tenantRecordService.getTenantByIdForSession(agentContext, 'tenant-id')

      expect(tenantRepository.getById).toHaveBeenCalledTimes(2)
    })

    const getCachedContext = (cache = new InMemoryLruCache({ limit: 10 })) => ({
      cache,
      cachedContext: getAgentContext({
        registerInstances: [
          [TenantsModuleConfig, new TenantsModuleConfig()],
          [CacheModuleConfig, new CacheModuleConfig({ cache })],
        ],
      }),
    })

    test('serves the session properties from the agent cache by default until the tenant is updated or deleted', async () => {
      const { cachedContext } = getCachedContext()
      mockFunction(tenantRepository.getById).mockResolvedValue(tenantRecord)

      await tenantRecordService.getTenantByIdForSession(cachedContext, 'tenant-id')
      const cached = await tenantRecordService.getTenantByIdForSession(cachedContext, 'tenant-id')
      expect(tenantRepository.getById).toHaveBeenCalledTimes(1)
      expect(cached).toEqual({ id: 'tenant-id', status: TenantStatus.Active, storageVersion: '0.5' })

      await tenantRecordService.updateTenant(cachedContext, tenantRecord)
      await tenantRecordService.getTenantByIdForSession(cachedContext, 'tenant-id')
      expect(tenantRepository.getById).toHaveBeenCalledTimes(2)

      mockFunction(tenantRoutingRepository.findByQuery).mockResolvedValue([])
      await tenantRecordService.deleteTenantById(cachedContext, 'tenant-id')
      await tenantRecordService.getTenantByIdForSession(cachedContext, 'tenant-id')
      // One read by the delete itself, one by the lookup after it
      expect(tenantRepository.getById).toHaveBeenCalledTimes(4)
    })

    test('caches only the id, status and storage version of the tenant record', async () => {
      const { cache, cachedContext } = getCachedContext()
      const recordWithStoreKey = new TenantRecord({
        id: 'tenant-id',
        config: tenantRecord.config,
        storageVersion: '0.5',
      })
      recordWithStoreKey.metadata.set('_askar/storeConfig', { key: 'store-key' })
      mockFunction(tenantRepository.getById).mockResolvedValue(recordWithStoreKey)

      await tenantRecordService.getTenantByIdForSession(cachedContext, 'tenant-id')

      const setSpy = vi.spyOn(cache, 'set')
      await tenantRecordService.updateTenant(cachedContext, recordWithStoreKey)
      await tenantRecordService.getTenantByIdForSession(cachedContext, 'tenant-id')
      expect(setSpy).toHaveBeenCalledTimes(1)
      expect(setSpy.mock.calls[0][2]).toEqual({ id: 'tenant-id', status: TenantStatus.Active, storageVersion: '0.5' })
    })

    test('does not cache a tenant record with outdated storage', async () => {
      const { cachedContext } = getCachedContext()
      const outdatedRecord = new TenantRecord({ id: 'tenant-id', config: tenantRecord.config, storageVersion: '0.4' })
      mockFunction(tenantRepository.getById).mockResolvedValue(outdatedRecord)

      await tenantRecordService.getTenantByIdForSession(cachedContext, 'tenant-id')
      await tenantRecordService.getTenantByIdForSession(cachedContext, 'tenant-id')

      expect(tenantRepository.getById).toHaveBeenCalledTimes(2)
    })

    test('reads cached session properties with outdated storage from storage again', async () => {
      const { cache, cachedContext } = getCachedContext()
      await cache.set(cachedContext, 'tenants:tenant-record:tenant-id', {
        id: 'tenant-id',
        status: TenantStatus.Active,
        storageVersion: '0.4',
      })
      mockFunction(tenantRepository.getById).mockResolvedValue(tenantRecord)

      const stored = await tenantRecordService.getTenantByIdForSession(cachedContext, 'tenant-id')

      expect(stored.storageVersion).toBe('0.5')
      expect(tenantRepository.getById).toHaveBeenCalledTimes(1)
    })

    test('does not use the SingleContextStorageLruCache and warns once', async () => {
      const cachedContext = getAgentContext({
        registerInstances: [
          [TenantsModuleConfig, new TenantsModuleConfig()],
          [CacheModuleConfig, new CacheModuleConfig({ cache: new SingleContextStorageLruCache({ limit: 10 }) })],
        ],
      })
      const warnSpy = vi.spyOn(cachedContext.config.logger, 'warn')
      mockFunction(tenantRepository.getById).mockResolvedValue(tenantRecord)

      await tenantRecordService.getTenantByIdForSession(cachedContext, 'tenant-id')
      await tenantRecordService.getTenantByIdForSession(cachedContext, 'tenant-id')

      expect(tenantRepository.getById).toHaveBeenCalledTimes(2)
      expect(warnSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('createTenant', () => {
    test('creates a tenant record and stores it in the tenant repository', async () => {
      const tenantRecord = await tenantRecordService.createTenant(agentContext, {
        label: 'Test Tenant',
      })

      expect(tenantRecord).toMatchObject({
        id: expect.any(String),
        config: {
          label: 'Test Tenant',
        },
      })

      expect(tenantRepository.save).toHaveBeenCalledWith(agentContext, tenantRecord)
    })
  })

  describe('getTenantById', () => {
    test('returns value from tenant repository get by id', async () => {
      const tenantRecord = vi.fn() as unknown as TenantRecord
      mockFunction(tenantRepository.getById).mockResolvedValue(tenantRecord)
      const returnedTenantRecord = await tenantRecordService.getTenantById(agentContext, 'tenantId')

      expect(returnedTenantRecord).toBe(tenantRecord)
    })
  })

  describe('deleteTenantById', () => {
    test('retrieves the tenant record and calls delete on the tenant repository', async () => {
      const tenantRecord = new TenantRecord({
        id: 'tenant-id',
        config: {
          label: 'Test Tenant',
        },
        storageVersion: '0.5',
      })
      mockFunction(tenantRepository.getById).mockResolvedValue(tenantRecord)
      mockFunction(tenantRoutingRepository.findByQuery).mockResolvedValue([])

      await tenantRecordService.deleteTenantById(agentContext, 'tenant-id')

      expect(tenantRepository.delete).toHaveBeenCalledWith(agentContext, tenantRecord)
    })

    test('deletes associated tenant routing records', async () => {
      const tenantRecord = new TenantRecord({
        id: 'tenant-id',
        config: {
          label: 'Test Tenant',
        },
        storageVersion: '0.5',
      })
      const tenantRoutingRecords = [
        new TenantRoutingRecord({
          recipientKeyFingerprint: '1',
          tenantId: 'tenant-id',
        }),
        new TenantRoutingRecord({
          recipientKeyFingerprint: '2',
          tenantId: 'tenant-id',
        }),
      ]

      mockFunction(tenantRepository.getById).mockResolvedValue(tenantRecord)
      mockFunction(tenantRoutingRepository.findByQuery).mockResolvedValue(tenantRoutingRecords)

      await tenantRecordService.deleteTenantById(agentContext, 'tenant-id')

      expect(tenantRoutingRepository.findByQuery).toHaveBeenCalledWith(agentContext, {
        tenantId: 'tenant-id',
      })

      expect(tenantRoutingRepository.delete).toHaveBeenCalledTimes(2)
      expect(tenantRoutingRepository.delete).toHaveBeenNthCalledWith(1, agentContext, tenantRoutingRecords[0])
      expect(tenantRoutingRepository.delete).toHaveBeenNthCalledWith(2, agentContext, tenantRoutingRecords[1])
    })
  })

  describe('findTenantRoutingRecordByRecipientKey', () => {
    test('returns value from tenant routing repository findByRecipientKey', async () => {
      const tenantRoutingRecord = vi.fn() as unknown as TenantRoutingRecord
      mockFunction(tenantRoutingRepository.findByRecipientKey).mockResolvedValue(tenantRoutingRecord)

      const recipientKey = Kms.PublicJwk.fromFingerprint('z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL')
      const returnedTenantRoutingRecord = await tenantRecordService.findTenantRoutingRecordByRecipientKey(
        agentContext,
        recipientKey
      )

      expect(tenantRoutingRepository.findByRecipientKey).toHaveBeenCalledWith(agentContext, recipientKey)
      expect(returnedTenantRoutingRecord).toBe(tenantRoutingRecord)
    })
  })

  describe('addTenantRoutingRecord', () => {
    test('creates a tenant routing record and stores it in the tenant routing repository', async () => {
      const recipientKey = Kms.PublicJwk.fromFingerprint('z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL')
      const tenantRoutingRecord = await tenantRecordService.addTenantRoutingRecord(
        agentContext,
        'tenant-id',
        recipientKey
      )

      expect(tenantRoutingRepository.save).toHaveBeenCalledWith(agentContext, tenantRoutingRecord)
      expect(tenantRoutingRecord).toMatchObject({
        id: expect.any(String),
        tenantId: 'tenant-id',
        recipientKeyFingerprint: 'z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
      })
    })
  })
})
