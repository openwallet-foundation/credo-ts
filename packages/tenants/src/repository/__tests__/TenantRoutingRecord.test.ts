import { JsonTransformer } from '@aries-framework/core'

import { TenantRoutingRecord } from '../TenantRoutingRecord'

describe('TenantRoutingRecord', () => {
  test('sets the values passed in the constructor on the record', () => {
    const createdAt = new Date()
    const tenantRoutingRecord = new TenantRoutingRecord({
      id: 'record-id',
      createdAt,
      tags: {
        some: 'tag',
      },
      tenantId: 'tenant-id',
      recipientKeyFingerprint: 'z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
    })

    expect(tenantRoutingRecord.type).toBe('TenantRoutingRecord')
    expect(tenantRoutingRecord.id).toBe('record-id')
    expect(tenantRoutingRecord.tenantId).toBe('tenant-id')
    expect(tenantRoutingRecord.createdAt).toBe(createdAt)
    expect(tenantRoutingRecord.recipientKeyFingerprint).toBe('z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL')
    expect(tenantRoutingRecord.getTags()).toMatchObject({
      some: 'tag',
    })
  })

  test('returns the default tags', () => {
    const tenantRoutingRecord = new TenantRoutingRecord({
      tenantId: 'tenant-id',
      recipientKeyFingerprint: 'z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
    })

    expect(tenantRoutingRecord.getTags()).toMatchObject({
      tenantId: 'tenant-id',
      recipientKeyFingerprint: 'z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
    })
  })

  test('serializes and deserializes', () => {
    const createdAt = new Date('2022-02-02')
    const tenantRoutingRecord = new TenantRoutingRecord({
      id: 'record-id',
      createdAt,
      tags: {
        some: 'tag',
      },
      tenantId: 'tenant-id',
      recipientKeyFingerprint: 'z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
    })

    const json = tenantRoutingRecord.toJSON()
    expect(json).toEqual({
      id: 'record-id',
      createdAt: '2022-02-02T00:00:00.000Z',
      recipientKeyFingerprint: 'z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
      tenantId: 'tenant-id',
      metadata: {},
      _tags: {
        some: 'tag',
      },
    })

    const instance = JsonTransformer.fromJSON(json, TenantRoutingRecord)

    expect(instance.type).toBe('TenantRoutingRecord')
    expect(instance.id).toBe('record-id')
    expect(instance.createdAt.getTime()).toBe(createdAt.getTime())
    expect(instance.recipientKeyFingerprint).toBe('z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL')
    expect(instance.tenantId).toBe('tenant-id')

    expect(instance.getTags()).toMatchObject({
      some: 'tag',
      recipientKeyFingerprint: 'z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
      tenantId: 'tenant-id',
    })
  })
})
