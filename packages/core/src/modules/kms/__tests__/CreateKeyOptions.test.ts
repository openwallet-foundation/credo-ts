import * as v from 'valibot'

import { vKmsCreateKeyType } from '../options/KmsCreateKeyOptions'

describe('CreateKeyOptions', () => {
  test('should throw error for invalid create key type', async () => {
    await expect(
      v.parseAsync(vKmsCreateKeyType, {
        kty: 'oct',
        algorithm: 'AES',
      })
    ).rejects.toThrow('Invalid type: Expected (128 | 192 | 256) but received undefined')
  })

  test('should correctly parse create key type', async () => {
    expect(() =>
      v.parse(vKmsCreateKeyType, {
        kty: 'oct',
        algorithm: 'AES',
        length: 128,
      })
    ).not.toThrow()

    expect(() =>
      v.parse(vKmsCreateKeyType, {
        kty: 'RSA',
        modulusLength: 4096,
      })
    ).not.toThrow()

    expect(() =>
      v.parse(vKmsCreateKeyType, {
        kty: 'EC',
        crv: 'P-256',
      })
    ).not.toThrow()

    expect(() =>
      v.parse(vKmsCreateKeyType, {
        kty: 'OKP',
        crv: 'Ed25519',
      })
    ).not.toThrow()
  })
})
