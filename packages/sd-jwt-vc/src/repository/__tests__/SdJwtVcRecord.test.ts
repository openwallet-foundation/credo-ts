import { JsonTransformer } from '@credo-ts/core'
import { SdJwtVc, SignatureAndEncryptionAlgorithm } from 'jwt-sd'

import { SdJwtVcRecord } from '../SdJwtVcRecord'

describe('SdJwtVcRecord', () => {
  const holderDidUrl = 'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y'

  test('sets the values passed in the constructor on the record', () => {
    const createdAt = new Date()
    const sdJwtVcRecord = new SdJwtVcRecord({
      id: 'sdjwt-id',
      createdAt,
      tags: {
        some: 'tag',
      },
      sdJwtVc: {
        header: { alg: SignatureAndEncryptionAlgorithm.EdDSA },
        payload: { iss: 'did:key:123' },
        signature: new Uint8Array(32).fill(42),
        holderDidUrl,
      },
    })

    expect(sdJwtVcRecord.type).toBe('SdJwtVcRecord')
    expect(sdJwtVcRecord.id).toBe('sdjwt-id')
    expect(sdJwtVcRecord.createdAt).toBe(createdAt)
    expect(sdJwtVcRecord.getTags()).toEqual({
      some: 'tag',
    })
    expect(sdJwtVcRecord.sdJwtVc).toEqual({
      header: { alg: SignatureAndEncryptionAlgorithm.EdDSA },
      payload: { iss: 'did:key:123' },
      signature: new Uint8Array(32).fill(42),
      holderDidUrl,
    })
  })

  test('serializes and deserializes', () => {
    const createdAt = new Date('2022-02-02')
    const sdJwtVcRecord = new SdJwtVcRecord({
      id: 'sdjwt-id',
      createdAt,
      tags: {
        some: 'tag',
      },
      sdJwtVc: {
        header: { alg: SignatureAndEncryptionAlgorithm.EdDSA },
        payload: { iss: 'did:key:123' },
        signature: new Uint8Array(32).fill(42),
        holderDidUrl,
      },
    })

    const json = sdJwtVcRecord.toJSON()
    expect(json).toMatchObject({
      id: 'sdjwt-id',
      createdAt: '2022-02-02T00:00:00.000Z',
      metadata: {},
      _tags: {
        some: 'tag',
      },
      sdJwtVc: {
        header: { alg: SignatureAndEncryptionAlgorithm.EdDSA },
        payload: { iss: 'did:key:123' },
        signature: new Uint8Array(32).fill(42),
      },
    })

    const instance = JsonTransformer.fromJSON(json, SdJwtVcRecord)

    expect(instance.type).toBe('SdJwtVcRecord')
    expect(instance.id).toBe('sdjwt-id')
    expect(instance.createdAt.getTime()).toBe(createdAt.getTime())
    expect(instance.getTags()).toEqual({
      some: 'tag',
    })
    expect(instance.sdJwtVc).toMatchObject({
      header: { alg: SignatureAndEncryptionAlgorithm.EdDSA },
      payload: { iss: 'did:key:123' },
      signature: new Uint8Array(32).fill(42),
    })
  })

  test('Get the pretty claims', async () => {
    const compactSdJwtVc =
      'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlVXM3ZWRWp3UmYwSWt0Sm9jdktSbUdIekhmV0FMdF9YMkswd3ZsdVpJU3MifX0sImlzcyI6ImRpZDprZXk6MTIzIiwiaWF0IjoxNjk4MTUxNTMyLCJfc2RfYWxnIjoic2hhLTI1NiIsIl9zZCI6WyJ2Y3ZGVTREc0ZLVHFRMXZsNG5lbEpXWFRiXy0wZE5vQmtzNmlxTkZwdHlnIl19.IW6PaMTtxMNvqwrRac5nh7L9_ie4r-PUDL6Gqoey2O3axTm6RBrUv0ETLbdgALK6tU_HoIDuNE66DVrISQXaCw~WyJzYWx0IiwiY2xhaW0iLCJzb21lLWNsYWltIl0~'

    const sdJwtVc = SdJwtVc.fromCompact(compactSdJwtVc)

    const sdJwtVcRecord = new SdJwtVcRecord({
      tags: {
        some: 'tag',
      },
      sdJwtVc: {
        header: sdJwtVc.header,
        payload: sdJwtVc.payload,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        signature: sdJwtVc.signature!,
        disclosures: sdJwtVc.disclosures?.map((d) => d.decoded),
        holderDidUrl,
      },
    })

    const prettyClaims = await sdJwtVcRecord.getPrettyClaims()

    expect(prettyClaims).toEqual({
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
