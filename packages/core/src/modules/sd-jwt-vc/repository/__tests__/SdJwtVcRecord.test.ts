import { JsonTransformer } from '@credo-ts/core'
import { SdJwtVcRecord } from '../SdJwtVcRecord'

describe('SdJwtVcRecord', () => {
  test('sets the values passed in the constructor on the record', () => {
    const compactSdJwtVc =
      'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCIsImtpZCI6Ino2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyJ9.eyJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJmYW1pbHlfbmFtZSI6IkRvZSIsInBob25lX251bWJlciI6IisxLTIwMi01NTUtMDEwMSIsImFkZHJlc3MiOnsic3RyZWV0X2FkZHJlc3MiOiIxMjMgTWFpbiBTdCIsImxvY2FsaXR5IjoiQW55dG93biIsIl9zZCI6WyJOSm5tY3QwQnFCTUUxSmZCbEM2alJRVlJ1ZXZwRU9OaVl3N0E3TUh1SnlRIiwib201Wnp0WkhCLUdkMDBMRzIxQ1ZfeE00RmFFTlNvaWFPWG5UQUpOY3pCNCJdfSwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Im9FTlZzeE9VaUg1NFg4d0pMYVZraWNDUmswMHdCSVE0c1JnYms1NE44TW8ifX0sImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XIiwiaWF0IjoxNjk4MTUxNTMyLCJfc2RfYWxnIjoic2hhLTI1NiIsIl9zZCI6WyIxQ3VyMmsyQTJvSUI1Q3NoU0lmX0FfS2ctbDI2dV9xS3VXUTc5UDBWZGFzIiwiUjF6VFV2T1lIZ2NlcGowakh5cEdIejlFSHR0VktmdDB5c3diYzlFVFBiVSIsImVEcVFwZFRYSlhiV2hmLUVzSTd6dzVYNk92WW1GTi1VWlFRTWVzWHdLUHciLCJwZERrMl9YQUtIbzdnT0Fmd0YxYjdPZENVVlRpdDJrSkhheFNFQ1E5eGZjIiwicHNhdUtVTldFaTA5bnUzQ2w4OXhLWGdtcFdFTlpsNXV5MU4xbnluX2pNayIsInNOX2dlMHBIWEY2cW1zWW5YMUE5U2R3SjhjaDhhRU5reGJPRHNUNzRZd0kiXX0.Yz5U__nC0Nccza-NNfqhp-GueKXqeFNjm_NNtC1AJ2KdmERhCHdO6KNjM7bOiruHlo4oAlj-xObuB9LRiKXeCw~WyJzYWx0IiwiaXNfb3Zlcl82NSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8yMSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8xOCIsdHJ1ZV0~WyJzYWx0IiwiYmlydGhkYXRlIiwiMTk0MC0wMS0wMSJd~WyJzYWx0IiwiZW1haWwiLCJqb2huZG9lQGV4YW1wbGUuY29tIl0~WyJzYWx0IiwicmVnaW9uIiwiQW55c3RhdGUiXQ~WyJzYWx0IiwiY291bnRyeSIsIlVTIl0~WyJzYWx0IiwiZ2l2ZW5fbmFtZSIsIkpvaG4iXQ~'
    const createdAt = new Date()
    const sdJwtVcRecord = new SdJwtVcRecord({
      id: 'sdjwt-id',
      createdAt,
      tags: {
        some: 'tag',
      },
      sdJwtVcs: [
        {
          compactSdJwtVc,
        },
      ],
    })

    expect(sdJwtVcRecord.type).toBe('SdJwtVcRecord')
    expect(sdJwtVcRecord.id).toBe('sdjwt-id')
    expect(sdJwtVcRecord.createdAt).toBe(createdAt)
    expect(sdJwtVcRecord.getTags()).toEqual({
      some: 'tag',
      alg: 'EdDSA',
      sdAlg: 'sha-256',
      vct: 'IdentityCredential',
    })
    expect(sdJwtVcRecord.encoded).toEqual(compactSdJwtVc)
  })

  test('serializes and deserializes', () => {
    const compactSdJwtVc =
      'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCIsImtpZCI6Ino2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyJ9.eyJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJmYW1pbHlfbmFtZSI6IkRvZSIsInBob25lX251bWJlciI6IisxLTIwMi01NTUtMDEwMSIsImFkZHJlc3MiOnsic3RyZWV0X2FkZHJlc3MiOiIxMjMgTWFpbiBTdCIsImxvY2FsaXR5IjoiQW55dG93biIsIl9zZCI6WyJOSm5tY3QwQnFCTUUxSmZCbEM2alJRVlJ1ZXZwRU9OaVl3N0E3TUh1SnlRIiwib201Wnp0WkhCLUdkMDBMRzIxQ1ZfeE00RmFFTlNvaWFPWG5UQUpOY3pCNCJdfSwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Im9FTlZzeE9VaUg1NFg4d0pMYVZraWNDUmswMHdCSVE0c1JnYms1NE44TW8ifX0sImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XIiwiaWF0IjoxNjk4MTUxNTMyLCJfc2RfYWxnIjoic2hhLTI1NiIsIl9zZCI6WyIxQ3VyMmsyQTJvSUI1Q3NoU0lmX0FfS2ctbDI2dV9xS3VXUTc5UDBWZGFzIiwiUjF6VFV2T1lIZ2NlcGowakh5cEdIejlFSHR0VktmdDB5c3diYzlFVFBiVSIsImVEcVFwZFRYSlhiV2hmLUVzSTd6dzVYNk92WW1GTi1VWlFRTWVzWHdLUHciLCJwZERrMl9YQUtIbzdnT0Fmd0YxYjdPZENVVlRpdDJrSkhheFNFQ1E5eGZjIiwicHNhdUtVTldFaTA5bnUzQ2w4OXhLWGdtcFdFTlpsNXV5MU4xbnluX2pNayIsInNOX2dlMHBIWEY2cW1zWW5YMUE5U2R3SjhjaDhhRU5reGJPRHNUNzRZd0kiXX0.Yz5U__nC0Nccza-NNfqhp-GueKXqeFNjm_NNtC1AJ2KdmERhCHdO6KNjM7bOiruHlo4oAlj-xObuB9LRiKXeCw~WyJzYWx0IiwiaXNfb3Zlcl82NSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8yMSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8xOCIsdHJ1ZV0~WyJzYWx0IiwiYmlydGhkYXRlIiwiMTk0MC0wMS0wMSJd~WyJzYWx0IiwiZW1haWwiLCJqb2huZG9lQGV4YW1wbGUuY29tIl0~WyJzYWx0IiwicmVnaW9uIiwiQW55c3RhdGUiXQ~WyJzYWx0IiwiY291bnRyeSIsIlVTIl0~WyJzYWx0IiwiZ2l2ZW5fbmFtZSIsIkpvaG4iXQ~'
    const createdAt = new Date('2022-02-02')
    const sdJwtVcRecord = new SdJwtVcRecord({
      id: 'sdjwt-id',
      createdAt,
      tags: {
        some: 'tag',
      },
      sdJwtVcs: [
        {
          compactSdJwtVc,
        },
      ],
    })

    const json = sdJwtVcRecord.toJSON()
    expect(json).toMatchObject({
      id: 'sdjwt-id',
      createdAt: '2022-02-02T00:00:00.000Z',
      metadata: {},
      _tags: {
        some: 'tag',
      },
      compactSdJwtVc,
    })

    const instance = JsonTransformer.deserialize(JSON.stringify(json), SdJwtVcRecord)

    expect(instance.type).toBe('SdJwtVcRecord')
    expect(instance.id).toBe('sdjwt-id')
    expect(instance.createdAt.getTime()).toBe(createdAt.getTime())
    expect(instance.getTags()).toEqual({
      some: 'tag',
      alg: 'EdDSA',
      sdAlg: 'sha-256',
      vct: 'IdentityCredential',
    })
    expect(instance.encoded).toBe(compactSdJwtVc)
  })
})
