import { JsonTransformer } from '@aries-framework/core'
import { SdJwtVc, SignatureAndEncryptionAlgorithm } from 'jwt-sd'

import { SdJwtRecord } from '../SdJwtRecord'

describe('SdJwtRecord', () => {
  test('sets the values passed in the constructor on the record', () => {
    const createdAt = new Date()
    const sdJwtRecord = new SdJwtRecord({
      id: 'sdjwt-id',
      createdAt,
      tags: {
        some: 'tag',
      },
      sdJwt: {
        header: { alg: SignatureAndEncryptionAlgorithm.EdDSA },
        payload: { iss: 'did:key:123' },
        signature: new Uint8Array(32).fill(42),
      },
    })

    expect(sdJwtRecord.type).toBe('SdJwtRecord')
    expect(sdJwtRecord.id).toBe('sdjwt-id')
    expect(sdJwtRecord.createdAt).toBe(createdAt)
    expect(sdJwtRecord.getTags()).toMatchObject({
      some: 'tag',
    })
    expect(sdJwtRecord.sdJwt).toMatchObject({
      header: { alg: SignatureAndEncryptionAlgorithm.EdDSA },
      payload: { iss: 'did:key:123' },
      signature: new Uint8Array(32).fill(42),
    })
  })

  test('serializes and deserializes', () => {
    const createdAt = new Date('2022-02-02')
    const sdJwtRecord = new SdJwtRecord({
      id: 'sdjwt-id',
      createdAt,
      tags: {
        some: 'tag',
      },
      sdJwt: {
        header: { alg: SignatureAndEncryptionAlgorithm.EdDSA },
        payload: { iss: 'did:key:123' },
        signature: new Uint8Array(32).fill(42),
      },
    })

    const json = sdJwtRecord.toJSON()
    expect(json).toMatchObject({
      id: 'sdjwt-id',
      createdAt: '2022-02-02T00:00:00.000Z',
      metadata: {},
      _tags: {
        some: 'tag',
      },
      sdJwt: {
        header: { alg: SignatureAndEncryptionAlgorithm.EdDSA },
        payload: { iss: 'did:key:123' },
        signature: new Uint8Array(32).fill(42),
      },
    })

    const instance = JsonTransformer.fromJSON(json, SdJwtRecord)

    expect(instance.type).toBe('SdJwtRecord')
    expect(instance.id).toBe('sdjwt-id')
    expect(instance.createdAt.getTime()).toBe(createdAt.getTime())
    expect(instance.getTags()).toMatchObject({
      some: 'tag',
    })
    expect(instance.sdJwt).toMatchObject({
      header: { alg: SignatureAndEncryptionAlgorithm.EdDSA },
      payload: { iss: 'did:key:123' },
      signature: new Uint8Array(32).fill(42),
    })
  })

  test('Get the pretty claims', async () => {
    const compactSdJwt =
      'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlVXM3ZWRWp3UmYwSWt0Sm9jdktSbUdIekhmV0FMdF9YMkswd3ZsdVpJU3MifX0sImlzcyI6ImRpZDprZXk6MTIzIiwiaWF0IjoxNjk4MTUxNTMyLCJfc2RfYWxnIjoic2hhLTI1NiIsIl9zZCI6WyJ2Y3ZGVTREc0ZLVHFRMXZsNG5lbEpXWFRiXy0wZE5vQmtzNmlxTkZwdHlnIl19.IW6PaMTtxMNvqwrRac5nh7L9_ie4r-PUDL6Gqoey2O3axTm6RBrUv0ETLbdgALK6tU_HoIDuNE66DVrISQXaCw~WyJzYWx0IiwiY2xhaW0iLCJzb21lLWNsYWltIl0~'

    const sdJwt = SdJwtVc.fromCompact(compactSdJwt)

    const sdJwtRecord = new SdJwtRecord({
      tags: {
        some: 'tag',
      },
      sdJwt: {
        header: sdJwt.header,
        payload: sdJwt.payload,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        signature: sdJwt.signature!,
        disclosures: sdJwt.disclosures?.map((d) => d.decoded),
      },
    })

    const prettyClaims = await sdJwtRecord.getPrettyClaims()

    expect(prettyClaims).toMatchObject({
      type: 'IdentityCredential',
      cnf: {
        jwk: {
          kty: 'OKP',
          crv: 'Ed25519',
          x: 'UW3vVEjwRf0IktJocvKRmGHzHfWALt_X2K0wvluZISs',
        },
      },
      iss: 'did:key:123',
      iat: 1698151532,
      claim: 'some-claim',
    })
  })
})
