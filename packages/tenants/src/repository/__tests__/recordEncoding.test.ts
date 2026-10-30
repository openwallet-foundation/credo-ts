import path from 'node:path'
import { JsonTransformer } from '@credo-ts/core'
import { testRecordEncoding } from '../../../../core/tests/recordEncoding'
import { TenantRecord, TenantStatus } from '../TenantRecord'
import { TenantRoutingRecord } from '../TenantRoutingRecord'

const createdAt = new Date('2026-01-01T00:00:00.000Z')
const updatedAt = new Date('2026-01-02T00:00:00.000Z')

testRecordEncoding(path.join(__dirname, '__fixtures__/records'), {
  TenantRecord: () => {
    const record = new TenantRecord({
      id: 'tenant-record-id',
      createdAt,
      tags: { custom: 'tag' },
      config: { label: 'Tenant Label' },
      storageVersion: '0.5',
      status: TenantStatus.Inactive,
    })
    record.updatedAt = updatedAt
    record.metadata.set('meta', { key: 'value' })
    return record
  },
  TenantRoutingRecord: () => {
    const record = new TenantRoutingRecord({
      id: 'tenant-routing-record-id',
      createdAt,
      tags: { custom: 'tag' },
      tenantId: 'tenant-record-id',
      recipientKeyFingerprint: 'z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
    })
    record.updatedAt = updatedAt
    record.metadata.set('meta', { key: 'value' })
    return record
  },
})

describe('TenantRecord legacy format', () => {
  test('defaults storageVersion to 0.4 and status to active for records stored without them', () => {
    const record = JsonTransformer.fromJSON(
      {
        id: 'tenant-record-id',
        createdAt: '2026-01-01T00:00:00.000Z',
        metadata: {},
        _tags: {},
        config: { label: 'Tenant Label' },
      },
      TenantRecord
    )

    expect(record.storageVersion).toBe('0.4')
    expect(record.status).toBe(TenantStatus.Active)
    expect(record.getTags()).toEqual({ label: 'Tenant Label', storageVersion: '0.4', status: 'active' })
    expect(record.toJSON()).toEqual({
      id: 'tenant-record-id',
      createdAt: '2026-01-01T00:00:00.000Z',
      metadata: {},
      _tags: {},
      config: { label: 'Tenant Label' },
      storageVersion: '0.4',
      status: 'active',
    })
  })
})
