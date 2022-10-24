import { JsonTransformer } from '@aries-framework/core'

import { TenantRecord } from '../TenantRecord'

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
        walletConfig: {
          id: 'test',
          key: 'test',
        },
      },
    })

    expect(tenantRecord.type).toBe('TenantRecord')
    expect(tenantRecord.id).toBe('tenant-id')
    expect(tenantRecord.createdAt).toBe(createdAt)
    expect(tenantRecord.config).toMatchObject({
      label: 'test',
      walletConfig: {
        id: 'test',
        key: 'test',
      },
    })
    expect(tenantRecord.getTags()).toMatchObject({
      some: 'tag',
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
        walletConfig: {
          id: 'test',
          key: 'test',
        },
      },
    })

    const json = tenantRecord.toJSON()
    expect(json).toEqual({
      id: 'tenant-id',
      createdAt: '2022-02-02T00:00:00.000Z',
      metadata: {},
      _tags: {
        some: 'tag',
      },
      config: {
        label: 'test',
        walletConfig: {
          id: 'test',
          key: 'test',
        },
      },
    })

    const instance = JsonTransformer.fromJSON(json, TenantRecord)

    expect(instance.type).toBe('TenantRecord')
    expect(instance.id).toBe('tenant-id')
    expect(instance.createdAt.getTime()).toBe(createdAt.getTime())
    expect(instance.config).toMatchObject({
      label: 'test',
      walletConfig: {
        id: 'test',
        key: 'test',
      },
    })
    expect(instance.getTags()).toMatchObject({
      some: 'tag',
    })
  })
})
