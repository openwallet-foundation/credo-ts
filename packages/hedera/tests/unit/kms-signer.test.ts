import type { AgentContext } from '@credo-ts/core'

import { Key, KeyType, Buffer } from '@credo-ts/core'
import { PrivateKey } from '@hashgraph/sdk'

import { mockFunction } from '../../../core/tests/helpers'
import { CredoSigner } from '../../src/ledger/signer/CredoSigner'
import { hederaPublicKeyFromCredoKey } from '../../src/ledger/utils'

jest.mock('../../src/ledger/utils', () => ({
  hederaPublicKeyFromCredoKey: jest.fn(),
}))

const hederaPrivateKey = PrivateKey.generateED25519()
const publicKey: Key = Key.fromPublicKey(hederaPrivateKey.publicKey.toBytesRaw(), KeyType.Ed25519)

describe('KmsSigner', () => {
  const signMock = jest.fn().mockResolvedValue(new Uint8Array([7, 8, 9]))
  const verifyMock = jest.fn().mockResolvedValue(true)

  const mockAgentContext: AgentContext = {
    wallet: {
      sign: signMock,
      verify: verifyMock,
    },
  } as unknown as AgentContext

  beforeEach(() => {
    jest.clearAllMocks()
    mockFunction(hederaPublicKeyFromCredoKey).mockReturnValue(hederaPrivateKey.publicKey)
  })

  it('should correctly create an instance via constructor', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _signer = new CredoSigner(mockAgentContext, publicKey)
    expect(hederaPublicKeyFromCredoKey).toHaveBeenCalledWith(publicKey)
  })

  it('should correctly update key in setKey', async () => {
    const newKey = Key.fromPublicKey(PrivateKey.generateED25519().publicKey.toBytesRaw(), KeyType.Ed25519)

    const signer = new CredoSigner(mockAgentContext, publicKey)
    await signer.setKey(newKey)

    expect(hederaPublicKeyFromCredoKey).toHaveBeenCalledWith(newKey)
    expect(hederaPublicKeyFromCredoKey).toHaveBeenCalledTimes(2)
  })

  it('should return correct publicKey', async () => {
    const signer = new CredoSigner(mockAgentContext, publicKey)
    const publicKeyDer = await signer.publicKey()

    expect(publicKeyDer).toBe(hederaPrivateKey.publicKey.toStringDer())
  })

  it('should sign data with KMS', async () => {
    const signer = new CredoSigner(mockAgentContext, publicKey)
    const data = new Uint8Array([4, 5, 6])

    const signature = await signer.sign(data)

    expect(mockAgentContext.wallet.sign).toHaveBeenCalledWith({
      key: publicKey,
      data: Buffer.from(data),
    })
    expect(signature).toEqual(new Uint8Array([7, 8, 9]))
  })

  it('should verify signature with KMS', async () => {
    const signer = new CredoSigner(mockAgentContext, publicKey)
    const message = new Uint8Array([4, 5, 6])
    const signature = new Uint8Array([7, 8, 9])

    const result = await signer.verify(message, signature)

    expect(mockAgentContext.wallet.verify).toHaveBeenCalledWith({
      key: publicKey,
      data: Buffer.from(message),
      signature: Buffer.from(signature),
    })
    expect(result).toBe(true)
  })
})
