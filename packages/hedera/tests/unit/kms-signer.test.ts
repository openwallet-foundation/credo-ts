import { Kms, TypedArrayEncoder } from '@credo-ts/core'
import { KeysUtility } from '@hiero-did-sdk/core'
import { KmsSigner } from '../../src/ledger/signer/KmsSigner'

jest.mock('@hiero-did-sdk/core', () => ({
  KeysUtility: {
    fromBytes: jest.fn(),
  },
  DIDError: class DIDError extends Error {},
  Signer: class Signer {},
}))

jest.mock('@credo-ts/core', () => ({
  TypedArrayEncoder: {
    fromBase64: jest.fn(),
  },
  Kms: {
    KeyManagementApi: jest.fn().mockImplementation(() => ({})),
  },
}))

jest.mock('../../src/ledger/utils', () => ({
  createOrGetKey: jest.fn(),
}))
import { createOrGetKey } from '../../src/ledger/utils'

jest.mock('@hashgraph/sdk', () => ({
  PublicKey: jest.fn(),
}))

describe('KmsSigner', () => {
  const signMock = jest.fn().mockResolvedValue({ signature: new Uint8Array([7, 8, 9]) })
  const verifyMock = jest.fn().mockResolvedValue({ verified: true })

  const kmsMock = {
    sign: signMock,
    verify: verifyMock,
  }

  const keyId = 'test-key-id'
  const base64X = 'base64-x'
  const publicJwk: Kms.KmsJwkPublicOkp & { crv: 'Ed25519' } = { x: base64X, crv: 'Ed25519', kty: 'OKP' }
  const key: { keyId: string; publicJwk: Kms.KmsJwkPublicOkp & { crv: 'Ed25519' } } = { keyId, publicJwk }

  const mockPublicKey = {
    toStringDer: jest.fn().mockReturnValue('mock-der-string'),
  }

  const mockKeysUtility = {
    toPublicKey: jest.fn().mockReturnValue(mockPublicKey),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(TypedArrayEncoder.fromBase64 as jest.Mock).mockReturnValue(new Uint8Array([1, 2, 3]))
    ;(KeysUtility.fromBytes as jest.Mock).mockReturnValue(mockKeysUtility)
  })

  it('should correctly create an instance via constructor', () => {
    const _signer = new KmsSigner(kmsMock as unknown as Kms.KeyManagementApi, key)

    expect(TypedArrayEncoder.fromBase64).toHaveBeenCalledWith(base64X)
    expect(KeysUtility.fromBytes).toHaveBeenCalledWith(expect.any(Uint8Array))
    expect(mockKeysUtility.toPublicKey).toHaveBeenCalled()
  })

  it('should correctly update key in setKeyId', async () => {
    ;(createOrGetKey as jest.Mock).mockResolvedValue({
      publicJwk: { x: base64X, crv: 'Ed25519' },
    })

    const signer = new KmsSigner(kmsMock as unknown as Kms.KeyManagementApi, key)
    await signer.setKeyId('new-key-id')

    expect(createOrGetKey).toHaveBeenCalledWith(kmsMock, 'new-key-id')
    expect(KeysUtility.fromBytes).toHaveBeenCalledTimes(2)
    expect(mockKeysUtility.toPublicKey).toHaveBeenCalledTimes(2)
  })

  it('should return correct publicKey', async () => {
    const signer = new KmsSigner(kmsMock as unknown as Kms.KeyManagementApi, key)
    const publicKey = await signer.publicKey()

    expect(publicKey).toBe('mock-der-string')
    expect(mockPublicKey.toStringDer).toHaveBeenCalled()
  })

  it('should sign data with KMS', async () => {
    const signer = new KmsSigner(kmsMock as unknown as Kms.KeyManagementApi, key)
    const data = new Uint8Array([4, 5, 6])

    const signature = await signer.sign(data)

    expect(kmsMock.sign).toHaveBeenCalledWith({
      keyId,
      data,
      algorithm: 'EdDSA',
    })
    expect(signature).toEqual(new Uint8Array([7, 8, 9]))
  })

  it('should verify signature with KMS', async () => {
    const signer = new KmsSigner(kmsMock as unknown as Kms.KeyManagementApi, key)
    const message = new Uint8Array([4, 5, 6])
    const signature = new Uint8Array([7, 8, 9])

    const result = await signer.verify(message, signature)

    expect(kmsMock.verify).toHaveBeenCalledWith({
      data: message,
      signature,
      key: { keyId },
      algorithm: 'EdDSA',
    })
    expect(result).toBe(true)
  })
})
