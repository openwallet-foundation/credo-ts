import { Kms } from '@credo-ts/core'
import { createOrGetKey, getMultibasePublicKey } from '../../src/ledger/utils'

describe('getMultibasePublicKey', () => {
  it('should return a base58 key string prefixed with "z"', () => {
    const base64X = 'dGVzdGtleQ==' // base64 for 'testkey'
    const publicJwk = {
      crv: 'Ed25519',
      x: base64X,
    }
    const multibaseKey = getMultibasePublicKey(publicJwk as Kms.KmsJwkPublicOkp & { crv: 'Ed25519' })

    expect(multibaseKey.startsWith('z')).toBe(true)
    expect(typeof multibaseKey).toBe('string')
  })
})

describe('createOrGetKey', () => {
  let kmsMock: jest.Mocked<Kms.KeyManagementApi>

  beforeEach(() => {
    kmsMock = {
      createKey: jest.fn(),
      getPublicKey: jest.fn(),
    } as unknown as jest.Mocked<Kms.KeyManagementApi>
  })

  it('should create a key if keyId is not provided', async () => {
    const fakeKeyId = 'key123'
    const fakeJwk: Kms.KmsJwkPublicOkp & { kid: string } = { kty: 'OKP', crv: 'Ed25519', x: 'xxx', kid: 'key123' }
    kmsMock.createKey.mockResolvedValue({
      keyId: fakeKeyId,
      publicJwk: fakeJwk,
    })

    const result = await createOrGetKey(kmsMock, undefined)

    expect(kmsMock.createKey).toHaveBeenCalledWith({ type: { crv: 'Ed25519', kty: 'OKP' } })
    expect(result).toEqual({
      keyId: fakeKeyId,
      publicJwk: fakeJwk,
    })
  })

  it('should retrieve an existing key if keyId is provided', async () => {
    const keyId = 'key456'
    const publicJwk: Kms.KmsJwkPublicOkp & { kid: string } = { kty: 'OKP', crv: 'Ed25519', x: 'xxx', kid: 'key123' }
    kmsMock.getPublicKey.mockResolvedValue(publicJwk)

    const result = await createOrGetKey(kmsMock, keyId)

    expect(kmsMock.getPublicKey).toHaveBeenCalledWith({ keyId })
    expect(result).toEqual({
      keyId,
      publicJwk: {
        ...publicJwk,
        crv: publicJwk.crv,
      },
    })
  })

  it('should throw an error if key with given keyId is not found', async () => {
    // @ts-ignore
    kmsMock.getPublicKey.mockResolvedValue(null)

    // Expect the function to throw an error for a missing key
    await expect(createOrGetKey(kmsMock, 'notfound')).rejects.toThrowError("Key with key id 'notfound' not found")
  })

  it('should throw an error if key has unsupported kty or crv', async () => {
    const keyId = 'badkey'
    const badJwk: Kms.KmsJwkPublicRsa & { kid: string } = { e: '', kid: 'key-1', n: '', kty: 'RSA' }

    kmsMock.getPublicKey.mockResolvedValue(badJwk)

    const spyDesc = jest.spyOn(Kms, 'getJwkHumanDescription').mockReturnValue('unsupported key type')

    await expect(createOrGetKey(kmsMock, keyId)).rejects.toThrow(
      `Key with key id '${keyId}' uses unsupported unsupported key type for did:hedera`
    )

    spyDesc.mockRestore()
  })
})
