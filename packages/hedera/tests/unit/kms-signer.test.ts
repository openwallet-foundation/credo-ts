import { KmsSigner } from '../../src/ledger/signer/KmsSigner'

const mockKeyId = 'test-key-id'
const mockPublicJwk = {
  keyId: mockKeyId,
  publicKey: { publicKey: new Uint8Array([1, 2, 3]) },
} as Kms.PublicJwk<Kms.Ed25519PublicJwk>

import { Kms } from '@credo-ts/core'
import { mockFunction } from '../../../core/tests/helpers'

jest.mock('@credo-ts/core', () => ({
  ...jest.requireActual('@credo-ts/core'),
  Kms: {
    KeyManagementApi: vi.fn().mockReturnValue({}),
    PublicJwk: {
      fromFingerprint: vi.fn().mockReturnValue(mockPublicJwk),
    },
  },
}))

jest.mock('../../src/ledger/utils', () => ({
  createOrGetKey: vi.fn(),
  hederaPublicKeyFromPublicJwk: vi.fn(),
}))

import { PublicKey } from '@hashgraph/sdk'
import { createOrGetKey, hederaPublicKeyFromPublicJwk } from '../../src/ledger/utils'

describe('KmsSigner', () => {
  const signMock = vi.fn().mockResolvedValue({ signature: new Uint8Array([7, 8, 9]) })
  const verifyMock = vi.fn().mockResolvedValue({ verified: true })

  const kmsMock = {
    sign: signMock,
    verify: verifyMock,
  }

  const mockPublicKey = {
    toStringDer: vi.fn().mockReturnValue('mock-der-string'),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockFunction(hederaPublicKeyFromPublicJwk).mockReturnValue(mockPublicKey as unknown as PublicKey)
  })

  it('should correctly create an instance via constructor', () => {
    const _signer = new KmsSigner(kmsMock as unknown as Kms.KeyManagementApi, mockPublicJwk)
    expect(hederaPublicKeyFromPublicJwk).toHaveBeenCalledWith(mockPublicJwk)
  })

  it('should correctly update key in setKeyId', async () => {
    const signer = new KmsSigner(kmsMock as unknown as Kms.KeyManagementApi, mockPublicJwk)
    await signer.setKeyId('new-key-id')

    expect(createOrGetKey).toHaveBeenCalledWith(kmsMock, 'new-key-id')
    expect(hederaPublicKeyFromPublicJwk).toHaveBeenCalledTimes(2)
  })

  it('should return correct publicKey', async () => {
    const signer = new KmsSigner(kmsMock as unknown as Kms.KeyManagementApi, mockPublicJwk)
    const publicKey = await signer.publicKey()

    expect(publicKey).toBe('mock-der-string')
    expect(mockPublicKey.toStringDer).toHaveBeenCalled()
  })

  it('should sign data with KMS', async () => {
    const signer = new KmsSigner(kmsMock as unknown as Kms.KeyManagementApi, mockPublicJwk)
    const data = new Uint8Array([4, 5, 6])

    const signature = await signer.sign(data)

    expect(kmsMock.sign).toHaveBeenCalledWith({
      keyId: mockKeyId,
      data,
      algorithm: 'EdDSA',
    })
    expect(signature).toEqual(new Uint8Array([7, 8, 9]))
  })

  it('should verify signature with KMS', async () => {
    const signer = new KmsSigner(kmsMock as unknown as Kms.KeyManagementApi, mockPublicJwk)
    const message = new Uint8Array([4, 5, 6])
    const signature = new Uint8Array([7, 8, 9])

    const result = await signer.verify(message, signature)

    expect(kmsMock.verify).toHaveBeenCalledWith({
      data: message,
      signature,
      key: { keyId: mockKeyId },
      algorithm: 'EdDSA',
    })
    expect(result).toBe(true)
  })
})
