import { JsonTransformer } from '@credo-ts/core'

import { TenantRecord, TenantStatus } from '../TenantRecord'

describe('TenantRecord', () => {
  test('sets the values passed in the constructor on the record', () => {
    const createdAt = new Date()
    const tenantRecord = new TenantRecord({
      id: 'tenant-id',
      createdAt,
      tags: {
        some: 'tag',
      },
      config: {
        label: 'test',
      },
      storageVersion: '0.5',
    })

    expect(tenantRecord.type).toBe('TenantRecord')
    expect(tenantRecord.id).toBe('tenant-id')
    expect(tenantRecord.createdAt).toBe(createdAt)
    expect(tenantRecord.config).toEqual({
      label: 'test',
    })
    expect(tenantRecord.status).toBe(TenantStatus.Active)
    expect(tenantRecord.getTags()).toEqual({
      label: 'test',
      some: 'tag',
      storageVersion: '0.5',
      status: 'active',
    })
  })

  test('serializes and deserializes', () => {
    const createdAt = new Date('2022-02-02')
    const tenantRecord = new TenantRecord({
      id: 'tenant-id',
      createdAt,
      tags: {
        some: 'tag',
      },
      config: {
        label: 'test',
      },
      storageVersion: '0.5',
    })

    const json = tenantRecord.toJSON()
    expect(json).toEqual({
      id: 'tenant-id',
      createdAt: '2022-02-02T00:00:00.000Z',
      metadata: {},
      storageVersion: '0.5',
      status: 'active',
      _tags: {
        some: 'tag',
      },
      config: {
        label: 'test',
      },
    })

    const instance = JsonTransformer.fromJSON(json, TenantRecord)

    expect(instance.type).toBe('TenantRecord')
    expect(instance.id).toBe('tenant-id')
    expect(instance.createdAt.getTime()).toBe(createdAt.getTime())
    expect(instance.config).toEqual({
      label: 'test',
    })
    expect(instance.getTags()).toEqual({
      label: 'test',
      some: 'tag',
      storageVersion: '0.5',
      status: 'active',
    })
  })

  test('defaults to active status for records stored before the status field was introduced', () => {
    const instance = JsonTransformer.fromJSON(
      {
        id: 'tenant-id',
        createdAt: '2022-02-02T00:00:00.000Z',
        metadata: {},
        storageVersion: '0.5',
        _tags: {},
        config: {
          label: 'test',
        },
      },
      TenantRecord
    )

    expect(instance.status).toBe(TenantStatus.Active)
  })

  test('keeps the inactive status when serializing and deserializing', () => {
    const tenantRecord = new TenantRecord({
      id: 'tenant-id',
      config: {
        label: 'test',
      },
      storageVersion: '0.5',
      status: TenantStatus.Inactive,
    })

    const instance = JsonTransformer.fromJSON(tenantRecord.toJSON(), TenantRecord)

    expect(instance.status).toBe(TenantStatus.Inactive)
    expect(instance.getTags().status).toBe('inactive')
  })
})
