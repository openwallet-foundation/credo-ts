import { parseWithErrorHandling } from '../../../utils/zod'
import { zKmsCreateKeyType } from '../options/KmsCreateKeyOptions'

describe('CreateKeyOptions', () => {
  test('should throw error for invalid create key type', async () => {
    expect(() =>
      parseWithErrorHandling(zKmsCreateKeyType, {
        kty: 'oct',
        algorithm: 'AES',
      })
    ).toThrow('Error validating schema with data {"kty":"oct","algorithm":"AES"}')
  })

  test('should correctly parse create key type', async () => {
    expect(() =>
      zKmsCreateKeyType.parse({
        kty: 'oct',
        algorithm: 'aes',
        length: 128,
      })
    ).not.toThrow()

    expect(() =>
      zKmsCreateKeyType.parse({
        kty: 'RSA',
        modulusLength: 4096,
      })
    ).not.toThrow()

    expect(() =>
      zKmsCreateKeyType.parse({
        kty: 'EC',
        crv: 'P-256',
      })
    ).not.toThrow()

    expect(() =>
      zKmsCreateKeyType.parse({
        kty: 'OKP',
        crv: 'Ed25519',
      })
    ).not.toThrow()
  })
})
