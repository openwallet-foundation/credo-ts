import { Kms } from '@credo-ts/core'
import { PublicKey } from '@hashgraph/sdk'
import { KeysUtility } from '@hiero-did-sdk/core'
import type { Mocked } from 'vitest'
import { mockFunction } from '../../../core/tests/helpers'
import { createOrGetKey, getMultibasePublicKey, hederaPublicKeyFromPublicJwk } from '../../src/ledger/utils'

vi.mock('@hiero-did-sdk/core', () => ({
  KeysUtility: {
    fromBytes: vi.fn(),
  },
}))

describe('getMultibasePublicKey', () => {
  it('should return a base58 key string prefixed with "z"', () => {
    const publicJwk = {
      keyId: 'test-key-id',
      publicKey: { publicKey: new Uint8Array([1, 2, 3]) },
    } as Kms.PublicJwk<Kms.Ed25519PublicJwk>
    const multibaseKey = getMultibasePublicKey(publicJwk)

    expect(multibaseKey.startsWith('z')).toBe(true)
    expect(typeof multibaseKey).toBe('string')
  })
})

describe('createOrGetKey', () => {
  let kmsMock: Mocked<Kms.KeyManagementApi>

  beforeEach(() => {
    kmsMock = {
      createKey: vi.fn(),
      getPublicKey: vi.fn(),
    } as unknown as Mocked<Kms.KeyManagementApi>
  })

  it('should create a key if keyId is not provided', async () => {
    const keyId = 'key123'
    const publicJwk: Kms.KmsJwkPublicOkp & { kid: string } = { kty: 'OKP', crv: 'Ed25519', x: 'xxx', kid: 'key123' }
    kmsMock.createKey.mockResolvedValue({
      keyId,
      publicJwk,
    })

    const result = await createOrGetKey(kmsMock, undefined)

    expect(kmsMock.createKey).toHaveBeenCalledWith({ type: { crv: 'Ed25519', kty: 'OKP' } })
    expect(result).toEqual(Kms.PublicJwk.fromPublicJwk(publicJwk))
  })

  it('should retrieve an existing key if keyId is provided', async () => {
    const keyId = 'key456'
    const publicJwk: Kms.KmsJwkPublicOkp & { kid: string } = { kty: 'OKP', crv: 'Ed25519', x: 'xxx', kid: 'key123' }
    kmsMock.getPublicKey.mockResolvedValue(publicJwk)

    const result = await createOrGetKey(kmsMock, keyId)

    expect(kmsMock.getPublicKey).toHaveBeenCalledWith({ keyId })
    expect(result).toEqual(Kms.PublicJwk.fromPublicJwk(publicJwk))
  })

  it('should throw an error if key with given keyId is not found', async () => {
    // @ts-expect-error
    kmsMock.getPublicKey.mockResolvedValue(null)

    // Expect the function to throw an error for a missing key
    await expect(createOrGetKey(kmsMock, 'notfound')).rejects.toThrow("Key with key id 'notfound' not found")
  })

  it('should throw an error if key has unsupported kty or crv', async () => {
    const keyId = 'badkey'
    const badJwk: Kms.KmsJwkPublicRsa & { kid: string } = { e: '', kid: 'key-1', n: '', kty: 'RSA' }

    kmsMock.getPublicKey.mockResolvedValue(badJwk)

    const spyDesc = vi.spyOn(Kms, 'getJwkHumanDescription').mockReturnValue('unsupported key type')

    await expect(createOrGetKey(kmsMock, keyId)).rejects.toThrow(
      `Key with key id '${keyId}' uses unsupported unsupported key type for did:hedera`
    )

    spyDesc.mockRestore()
  })
})

describe('hederaPublicKeyFromPublicJwk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should convert a public JWK to a Hedera PublicKey', () => {
    const mockPublicKey = { toPublicKey: vi.fn() } as unknown as ReturnType<typeof KeysUtility.fromBytes>
    const mockHederaPublicKey = {} as PublicKey

    mockFunction(mockPublicKey.toPublicKey).mockReturnValue(mockHederaPublicKey)
    mockFunction(KeysUtility.fromBytes).mockReturnValue(mockPublicKey)

    const publicJwk = {
      keyId: 'test-key-id',
      publicKey: { publicKey: new Uint8Array([1, 2, 3, 4, 5]) },
    } as Kms.PublicJwk<Kms.Ed25519PublicJwk>

    const result = hederaPublicKeyFromPublicJwk(publicJwk)

    expect(KeysUtility.fromBytes).toHaveBeenCalledWith(publicJwk.publicKey.publicKey)
    expect(mockPublicKey.toPublicKey).toHaveBeenCalled()
    expect(result).toBe(mockHederaPublicKey)
  })
})
