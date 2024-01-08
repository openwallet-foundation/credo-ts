import { JsonTransformer } from '@aries-framework/core'
import { SdJwtVc, SignatureAndEncryptionAlgorithm } from '@sd-jwt/core'

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

    const instance = JsonTransformer.deserialize(JSON.stringify(json), SdJwtVcRecord)

    expect(instance.type).toBe('SdJwtVcRecord')
    expect(instance.id).toBe('sdjwt-id')
    expect(instance.createdAt.getTime()).toBe(createdAt.getTime())
    expect(instance.getTags()).toEqual({
      some: 'tag',
    })
    expect(instance.sdJwtVc.signature).toBeInstanceOf(Uint8Array)
    expect(instance.sdJwtVc).toMatchObject({
      header: { alg: SignatureAndEncryptionAlgorithm.EdDSA },
      payload: { iss: 'did:key:123' },
      signature: new Uint8Array(32).fill(42),
    })
  })

  test('Get the pretty claims', async () => {
    const compactSdJwtVc =
      'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCIsImtpZCI6Ino2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyJ9.eyJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJjbmYiOnsiandrIjp7Imt0eSI6Ik9LUCIsImNydiI6IkVkMjU1MTkiLCJ4Ijoib0VOVnN4T1VpSDU0WDh3SkxhVmtpY0NSazAwd0JJUTRzUmdiazU0TjhNbyJ9fSwiaXNzIjoiZGlkOmtleTp6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJpYXQiOjE2OTgxNTE1MzIsIl9zZF9hbGciOiJzaGEtMjU2IiwiX3NkIjpbInZjdkZVNERzRktUcVExdmw0bmVsSldYVGJfLTBkTm9Ca3M2aXFORnB0eWciXX0.yUYqg_7fkgvh4vnoWW4L6OZpM1eAatAfKUUMhHt2xYdHtQYHdVOch1Om-mpN2lTsyw9L1sZ5KsuAx7-5T-jlDQ~WyJzYWx0IiwiY2xhaW0iLCJzb21lLWNsYWltIl0~'

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
      vct: 'IdentityCredential',
      cnf: {
        jwk: {
          kty: 'OKP',
          crv: 'Ed25519',
          x: 'oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo',
        },
      },
      iss: 'did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      iat: 1698151532,
      claim: 'some-claim',
    })
  })
})
