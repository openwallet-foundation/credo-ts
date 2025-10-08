import { Kms } from '@credo-ts/core'
import { getAgentContext, mockFunction } from '../../../../core/tests/helpers'
import { TenantRecord, TenantRoutingRecord } from '../../repository'
import { TenantRepository } from '../../repository/TenantRepository'
import { TenantRoutingRepository } from '../../repository/TenantRoutingRepository'
import { TenantRecordService } from '../TenantRecordService'

jest.mock('../../repository/TenantRepository')
const TenantRepositoryMock = TenantRepository as jest.Mock<TenantRepository>
jest.mock('../../repository/TenantRoutingRepository')
const TenantRoutingRepositoryMock = TenantRoutingRepository as jest.Mock<TenantRoutingRepository>

const tenantRepository = new TenantRepositoryMock()
const tenantRoutingRepository = new TenantRoutingRepositoryMock()
const agentContext = getAgentContext({})

const tenantRecordService = new TenantRecordService(tenantRepository, tenantRoutingRepository)

describe('TenantRecordService', () => {
  afterEach(() => {
    jest.clearAllMocks()
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
