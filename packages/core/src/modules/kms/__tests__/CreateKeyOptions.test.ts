import { vKmsCreateKeyType } from '../options/KmsCreateKeyOptions'

describe('CreateKeyOptions', () => {
  test('should throw error for invalid create key type', async () => {
    await expect(
      vKmsCreateKeyType.parseAsync({
        kty: 'oct',
        algorithm: 'AES',
      })
    ).rejects.toThrow('Invalid type: Expected (128 | 192 | 256) but received undefined')
  })

  test('should correctly parse create key type', async () => {
    expect(() =>
      vKmsCreateKeyType.parse({
        kty: 'oct',
        algorithm: 'AES',
        length: 128,
      })
    ).not.toThrow()

    expect(() =>
      vKmsCreateKeyType.parse({
        kty: 'RSA',
        modulusLength: 4096,
      })
    ).not.toThrow()

    expect(() =>
      vKmsCreateKeyType.parse({
        kty: 'EC',
        crv: 'P-256',
      })
    ).not.toThrow()

    expect(() =>
      vKmsCreateKeyType.parse({
        kty: 'OKP',
        crv: 'Ed25519',
      })
    ).not.toThrow()
  })
})
