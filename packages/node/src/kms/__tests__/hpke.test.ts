import { Kms, TypedArrayEncoder } from '@credo-ts/core'
import { getAgentContext } from '../../../../core/tests'
import { NodeInMemoryKeyManagementStorage } from '../NodeInMemoryKeyManagementStorage'
import { NodeKeyManagementService } from '../NodeKeyManagementService'

const agentContext = getAgentContext({ contextCorrelationId: 'default' })

const hex = (value: string) => TypedArrayEncoder.fromHex(value)
const hexToBase64Url = (value: string) => TypedArrayEncoder.toBase64Url(hex(value))

/**
 * RFC 9180 Appendix A.3 — DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-128-GCM, base mode.
 * This is exactly the HPKE-0 suite, and the suite ISO 18013-7 Annex C fixes for the DC API.
 */
const rfc9180A3 = {
  recipientPrivateJwk: {
    kty: 'EC',
    crv: 'P-256',
    x: '_owZzgkFGR68KYqSRXklMfJvDOziRgY56Lw5y39waoI',
    y: 'anebTPlpuKDlOcf2L7PTCtaqj4DjDx0Siq_WiiznLqA',
    d: '885_2uV-GjENh_HrvebzKL4Kmc28rfTWWJzyneS4_9I',
  },
  enc: hex(
    '04a92719c6195d5085104f469a8b9814d5838ff72b60501e2c4466e5e67b325ac98536d7b61a1af4b78e5b7f951c0900be863c403ce65c9bfcb9382657222d18c4'
  ),
  info: hex('4f6465206f6e2061204772656369616e2055726e'),
  aad: hex('436f756e742d30'),
  ciphertext: hex('5ad590bb8baa577f8619db35a36311226a896e7342a6d836d8b7bcd2f20b6c7f9076ac232e3ab2523f39513434'),
  plaintext: 'Beauty is truth, truth beauty',
} as const

/**
 * RFC 9180 Appendix A.1 — DHKEM(X25519, HKDF-SHA256), HKDF-SHA256, AES-128-GCM, base mode.
 * This is exactly the HPKE-3 suite. The JWK is built from the RFC's raw `skRm`/`pkRm`.
 */
const rfc9180A1 = {
  recipientPrivateJwk: {
    kty: 'OKP',
    crv: 'X25519',
    x: hexToBase64Url('3948cfe0ad1ddb695d780e59077195da6c56506b027329794ab02bca80815c4d'),
    d: hexToBase64Url('4612c550263fc8ad58375df3f557aac531d26850903e55a9f23f21d8534e8ac8'),
  },
  enc: hex('37fda3567bdbd628e88668c3c8d7e97d1d1253b6d4ea6d44c150f741f1bf4431'),
  info: hex('4f6465206f6e2061204772656369616e2055726e'),
  aad: hex('436f756e742d30'),
  ciphertext: hex('f938558b5d72f1a23810b4be2ab4f84331acc02fc97babc53a52ae8218a355a96d8770ac83d07bea87e13c512a'),
  plaintext: 'Beauty is truth, truth beauty',
} as const

describe('NodeKeyManagementService HPKE', () => {
  let service: NodeKeyManagementService

  beforeEach(() => {
    service = new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage())
  })

  it('supports the HPKE algorithms for encrypt and decrypt', () => {
    for (const algorithm of ['HPKE-0', 'HPKE-3', 'HPKE-7'] as const) {
      expect(
        service.isOperationSupported(agentContext, {
          operation: 'decrypt',
          decryption: { algorithm: 'HPKE' },
          keyAgreement: { algorithm, keyId: 'key-1', encapsulatedKey: new Uint8Array() },
        })
      ).toBe(true)
    }
  })

  it('decrypts the RFC 9180 A.3 test vector', async () => {
    const { keyId } = await service.importKey(agentContext, {
      privateJwk: { ...rfc9180A3.recipientPrivateJwk, kid: 'rfc9180-a3' },
    })

    const { data } = await service.decrypt(agentContext, {
      key: {
        keyAgreement: {
          algorithm: 'HPKE-0',
          keyId,
          encapsulatedKey: rfc9180A3.enc,
          info: rfc9180A3.info,
        },
      },
      decryption: { algorithm: 'HPKE', aad: rfc9180A3.aad },
      encrypted: rfc9180A3.ciphertext,
    })

    expect(TypedArrayEncoder.toUtf8String(data)).toBe(rfc9180A3.plaintext)
  })

  it.each(['HPKE-0', 'HPKE-7'] as const)('round-trips %s with a P-256 key', async (algorithm) => {
    const { keyId, publicJwk } = await service.createKey(agentContext, {
      type: { kty: 'EC', crv: 'P-256' },
      keyId: `hpke-round-trip-${algorithm}`,
    })

    const data = TypedArrayEncoder.fromUtf8String('the quick brown fox')
    const info = TypedArrayEncoder.fromUtf8String('session transcript')

    const { encrypted, encapsulatedKey } = await service.encrypt(agentContext, {
      key: { keyAgreement: { algorithm, externalPublicJwk: publicJwk, info } },
      encryption: { algorithm: 'HPKE' },
      data,
    })

    expect(encapsulatedKey).toHaveLength(65)

    const decrypted = await service.decrypt(agentContext, {
      key: { keyAgreement: { algorithm, keyId, encapsulatedKey: encapsulatedKey as Uint8Array, info } },
      decryption: { algorithm: 'HPKE' },
      encrypted,
    })

    expect(decrypted.data).toEqual(data)
  })

  it('round-trips HPKE-3 with an X25519 key', async () => {
    const { keyId, publicJwk } = await service.createKey(agentContext, {
      type: { kty: 'OKP', crv: 'X25519' },
      keyId: 'hpke-round-trip-x25519',
    })

    const data = TypedArrayEncoder.fromUtf8String('the quick brown fox')

    const { encrypted, encapsulatedKey } = await service.encrypt(agentContext, {
      key: { keyAgreement: { algorithm: 'HPKE-3', externalPublicJwk: publicJwk } },
      encryption: { algorithm: 'HPKE' },
      data,
    })

    expect(encapsulatedKey).toHaveLength(32)

    const decrypted = await service.decrypt(agentContext, {
      key: { keyAgreement: { algorithm: 'HPKE-3', keyId, encapsulatedKey: encapsulatedKey as Uint8Array } },
      decryption: { algorithm: 'HPKE' },
      encrypted,
    })

    expect(decrypted.data).toEqual(data)
  })

  it('fails to decrypt when aad does not match', async () => {
    const { keyId, publicJwk } = await service.createKey(agentContext, {
      type: { kty: 'EC', crv: 'P-256' },
      keyId: 'hpke-aad-mismatch',
    })

    const { encrypted, encapsulatedKey } = await service.encrypt(agentContext, {
      key: {
        keyAgreement: {
          algorithm: 'HPKE-0',
          externalPublicJwk: publicJwk,
        },
      },
      encryption: { algorithm: 'HPKE', aad: TypedArrayEncoder.fromUtf8String('aad-a') },
      data: TypedArrayEncoder.fromUtf8String('secret'),
    })

    await expect(
      service.decrypt(agentContext, {
        key: {
          keyAgreement: {
            algorithm: 'HPKE-0',
            keyId,
            encapsulatedKey: encapsulatedKey as Uint8Array,
          },
        },
        decryption: { algorithm: 'HPKE', aad: TypedArrayEncoder.fromUtf8String('aad-b') },
        encrypted,
      })
    ).rejects.toThrow('Error decrypting')
  })

  it('rejects a key on a curve the HPKE suite is not defined over', async () => {
    const { publicJwk } = await service.createKey(agentContext, {
      type: { kty: 'EC', crv: 'P-384' },
      keyId: 'hpke-wrong-curve',
    })

    await expect(
      service.encrypt(agentContext, {
        key: { keyAgreement: { algorithm: 'HPKE-0', externalPublicJwk: publicJwk } },
        encryption: { algorithm: 'HPKE' },
        data: TypedArrayEncoder.fromUtf8String('secret'),
      })
    ).rejects.toThrow(`EC key with crv 'P-384' cannot be used with algorithm 'HPKE-0' for key derivation`)
  })

  it('decrypts the RFC 9180 A.1 test vector', async () => {
    const { keyId } = await service.importKey(agentContext, {
      privateJwk: { ...rfc9180A1.recipientPrivateJwk, kid: 'rfc9180-a1' },
    })

    const { data } = await service.decrypt(agentContext, {
      key: {
        keyAgreement: {
          algorithm: 'HPKE-3',
          keyId,
          encapsulatedKey: rfc9180A1.enc,
          info: rfc9180A1.info,
        },
      },
      decryption: { algorithm: 'HPKE', aad: rfc9180A1.aad },
      encrypted: rfc9180A1.ciphertext,
    })

    expect(TypedArrayEncoder.toUtf8String(data)).toBe(rfc9180A1.plaintext)
  })

  it('round-trips an empty payload', async () => {
    const { keyId, publicJwk } = await service.createKey(agentContext, {
      type: { kty: 'EC', crv: 'P-256' },
      keyId: 'hpke-empty-payload',
    })

    const { encrypted, encapsulatedKey } = await service.encrypt(agentContext, {
      key: { keyAgreement: { algorithm: 'HPKE-0', externalPublicJwk: publicJwk } },
      encryption: { algorithm: 'HPKE' },
      data: new Uint8Array(),
    })

    // Nothing to encrypt, so the ciphertext is exactly the 16-byte AES-GCM tag
    expect(encrypted).toHaveLength(16)

    const decrypted = await service.decrypt(agentContext, {
      key: { keyAgreement: { algorithm: 'HPKE-0', keyId, encapsulatedKey: encapsulatedKey as Uint8Array } },
      decryption: { algorithm: 'HPKE' },
      encrypted,
    })

    expect(decrypted.data).toEqual(new Uint8Array())
  })

  it('round-trips with both info and aad bound to the message', async () => {
    const { keyId, publicJwk } = await service.createKey(agentContext, {
      type: { kty: 'EC', crv: 'P-256' },
      keyId: 'hpke-info-and-aad',
    })

    const data = TypedArrayEncoder.fromUtf8String('the quick brown fox')
    const info = TypedArrayEncoder.fromUtf8String('session transcript')
    const aad = TypedArrayEncoder.fromUtf8String('external authenticated data')

    const { encrypted, encapsulatedKey } = await service.encrypt(agentContext, {
      key: { keyAgreement: { algorithm: 'HPKE-0', externalPublicJwk: publicJwk, info } },
      encryption: { algorithm: 'HPKE', aad },
      data,
    })

    const decrypted = await service.decrypt(agentContext, {
      key: { keyAgreement: { algorithm: 'HPKE-0', keyId, encapsulatedKey: encapsulatedKey as Uint8Array, info } },
      decryption: { algorithm: 'HPKE', aad },
      encrypted,
    })

    expect(decrypted.data).toEqual(data)
  })

  it('uses a fresh ephemeral key for every seal', async () => {
    const { publicJwk } = await service.createKey(agentContext, {
      type: { kty: 'EC', crv: 'P-256' },
      keyId: 'hpke-fresh-ephemeral',
    })

    const data = TypedArrayEncoder.fromUtf8String('the quick brown fox')
    const encryptOptions = {
      key: { keyAgreement: { algorithm: 'HPKE-0', externalPublicJwk: publicJwk } },
      encryption: { algorithm: 'HPKE' },
      data,
    } as const

    const first = await service.encrypt(agentContext, encryptOptions)
    const second = await service.encrypt(agentContext, encryptOptions)

    expect(first.encapsulatedKey).not.toEqual(second.encapsulatedKey)
    expect(first.encrypted).not.toEqual(second.encrypted)
  })

  it('fails to decrypt when info does not match', async () => {
    const { keyId, publicJwk } = await service.createKey(agentContext, {
      type: { kty: 'EC', crv: 'P-256' },
      keyId: 'hpke-info-mismatch',
    })

    const { encrypted, encapsulatedKey } = await service.encrypt(agentContext, {
      key: {
        keyAgreement: {
          algorithm: 'HPKE-0',
          externalPublicJwk: publicJwk,
          info: TypedArrayEncoder.fromUtf8String('origin-a'),
        },
      },
      encryption: { algorithm: 'HPKE' },
      data: TypedArrayEncoder.fromUtf8String('secret'),
    })

    await expect(
      service.decrypt(agentContext, {
        key: {
          keyAgreement: {
            algorithm: 'HPKE-0',
            keyId,
            encapsulatedKey: encapsulatedKey as Uint8Array,
            info: TypedArrayEncoder.fromUtf8String('origin-b'),
          },
        },
        decryption: { algorithm: 'HPKE' },
        encrypted,
      })
    ).rejects.toThrow('Error decrypting')
  })

  it('fails to decrypt when the ciphertext is tampered with', async () => {
    const { keyId, publicJwk } = await service.createKey(agentContext, {
      type: { kty: 'EC', crv: 'P-256' },
      keyId: 'hpke-tampered-ciphertext',
    })

    const { encrypted, encapsulatedKey } = await service.encrypt(agentContext, {
      key: { keyAgreement: { algorithm: 'HPKE-0', externalPublicJwk: publicJwk } },
      encryption: { algorithm: 'HPKE' },
      data: TypedArrayEncoder.fromUtf8String('secret'),
    })

    const tampered = new Uint8Array(encrypted)
    tampered[0] ^= 0xff

    await expect(
      service.decrypt(agentContext, {
        key: { keyAgreement: { algorithm: 'HPKE-0', keyId, encapsulatedKey: encapsulatedKey as Uint8Array } },
        decryption: { algorithm: 'HPKE' },
        encrypted: tampered,
      })
    ).rejects.toThrow('Error decrypting')
  })

  it('fails to decrypt when the encapsulated key is tampered with', async () => {
    const { keyId, publicJwk } = await service.createKey(agentContext, {
      type: { kty: 'EC', crv: 'P-256' },
      keyId: 'hpke-tampered-enc',
    })

    const { encrypted, encapsulatedKey } = await service.encrypt(agentContext, {
      key: { keyAgreement: { algorithm: 'HPKE-0', externalPublicJwk: publicJwk } },
      encryption: { algorithm: 'HPKE' },
      data: TypedArrayEncoder.fromUtf8String('secret'),
    })

    // Flip a bit in the x coordinate, keeping the 0x04 uncompressed point prefix intact
    const tampered = new Uint8Array(encapsulatedKey as Uint8Array)
    tampered[1] ^= 0xff

    await expect(
      service.decrypt(agentContext, {
        key: { keyAgreement: { algorithm: 'HPKE-0', keyId, encapsulatedKey: tampered } },
        decryption: { algorithm: 'HPKE' },
        encrypted,
      })
    ).rejects.toThrow('Error decrypting')
  })

  it('fails to decrypt with a different recipient key', async () => {
    const { publicJwk } = await service.createKey(agentContext, {
      type: { kty: 'EC', crv: 'P-256' },
      keyId: 'hpke-recipient',
    })
    const { keyId: otherKeyId } = await service.createKey(agentContext, {
      type: { kty: 'EC', crv: 'P-256' },
      keyId: 'hpke-other-recipient',
    })

    const { encrypted, encapsulatedKey } = await service.encrypt(agentContext, {
      key: { keyAgreement: { algorithm: 'HPKE-0', externalPublicJwk: publicJwk } },
      encryption: { algorithm: 'HPKE' },
      data: TypedArrayEncoder.fromUtf8String('secret'),
    })

    await expect(
      service.decrypt(agentContext, {
        key: {
          keyAgreement: { algorithm: 'HPKE-0', keyId: otherKeyId, encapsulatedKey: encapsulatedKey as Uint8Array },
        },
        decryption: { algorithm: 'HPKE' },
        encrypted,
      })
    ).rejects.toThrow('Error decrypting')
  })

  it('fails to decrypt when the HPKE suite does not match the one used to seal', async () => {
    const { keyId, publicJwk } = await service.createKey(agentContext, {
      type: { kty: 'EC', crv: 'P-256' },
      keyId: 'hpke-suite-mismatch',
    })

    // HPKE-0 and HPKE-7 share a KEM and KDF, and differ only in the AEAD
    const { encrypted, encapsulatedKey } = await service.encrypt(agentContext, {
      key: { keyAgreement: { algorithm: 'HPKE-0', externalPublicJwk: publicJwk } },
      encryption: { algorithm: 'HPKE' },
      data: TypedArrayEncoder.fromUtf8String('secret'),
    })

    await expect(
      service.decrypt(agentContext, {
        key: { keyAgreement: { algorithm: 'HPKE-7', keyId, encapsulatedKey: encapsulatedKey as Uint8Array } },
        decryption: { algorithm: 'HPKE' },
        encrypted,
      })
    ).rejects.toThrow('Error decrypting')
  })

  it('fails to decrypt with an unknown key id', async () => {
    await expect(
      service.decrypt(agentContext, {
        key: {
          keyAgreement: { algorithm: 'HPKE-0', keyId: 'does-not-exist', encapsulatedKey: rfc9180A3.enc },
        },
        decryption: { algorithm: 'HPKE' },
        encrypted: rfc9180A3.ciphertext,
      })
    ).rejects.toThrow(Kms.KeyManagementKeyNotFoundError)
  })

  it('rejects an X25519 key for an HPKE suite defined over P-256', async () => {
    const { publicJwk } = await service.createKey(agentContext, {
      type: { kty: 'OKP', crv: 'X25519' },
      keyId: 'hpke-x25519-for-p256-suite',
    })

    await expect(
      service.encrypt(agentContext, {
        key: { keyAgreement: { algorithm: 'HPKE-0', externalPublicJwk: publicJwk } },
        encryption: { algorithm: 'HPKE' },
        data: TypedArrayEncoder.fromUtf8String('secret'),
      })
    ).rejects.toThrow(`OKP key with crv 'X25519' cannot be used with algorithm 'HPKE-0' for key derivation`)
  })

  it('rejects a key whose `alg` restricts it to another HPKE suite', async () => {
    const { publicJwk } = await service.createKey(agentContext, {
      type: { kty: 'EC', crv: 'P-256' },
      keyId: 'hpke-alg-restricted',
    })

    await expect(
      service.encrypt(agentContext, {
        key: {
          keyAgreement: { algorithm: 'HPKE-7', externalPublicJwk: { ...publicJwk, alg: 'HPKE-0' } },
        },
        encryption: { algorithm: 'HPKE' },
        data: TypedArrayEncoder.fromUtf8String('secret'),
      })
    ).rejects.toThrow(`cannot be used with algorithm 'HPKE-7' for key derivation. Allowed algs are 'HPKE-0'`)
  })

  it('rejects a key whose usage does not allow key derivation', async () => {
    const { publicJwk } = await service.createKey(agentContext, {
      type: { kty: 'EC', crv: 'P-256' },
      keyId: 'hpke-use-restricted',
    })

    await expect(
      service.encrypt(agentContext, {
        key: {
          keyAgreement: { algorithm: 'HPKE-0', externalPublicJwk: { ...publicJwk, use: 'sig' } },
        },
        encryption: { algorithm: 'HPKE' },
        data: TypedArrayEncoder.fromUtf8String('secret'),
      })
    ).rejects.toThrow('usage does not allow key derivation operations')
  })

  it('rejects HPKE encryption that is not paired with an HPKE key agreement algorithm', async () => {
    const { publicJwk } = await service.createKey(agentContext, {
      type: { kty: 'EC', crv: 'P-256' },
      keyId: 'hpke-encryption-without-hpke-agreement',
    })

    // The zod schema already rules these out, so the cast stands in for a caller reaching
    // the service directly with options that never went through validation
    await expect(
      service.encrypt(agentContext, {
        key: { keyAgreement: { algorithm: 'ECDH-ES', externalPublicJwk: publicJwk } },
        encryption: { algorithm: 'HPKE' },
        data: TypedArrayEncoder.fromUtf8String('secret'),
      } as unknown as Kms.KmsEncryptOptions)
    ).rejects.toThrow(
      `Encryption algorithm 'HPKE' can only be used with an integrated-encryption HPKE key agreement algorithm`
    )

    await expect(
      service.encrypt(agentContext, {
        key: {},
        encryption: { algorithm: 'HPKE' },
        data: TypedArrayEncoder.fromUtf8String('secret'),
      } as unknown as Kms.KmsEncryptOptions)
    ).rejects.toThrow(
      `Encryption algorithm 'HPKE' can only be used with an integrated-encryption HPKE key agreement algorithm`
    )
  })

  it('rejects HPKE decryption that is not paired with an HPKE key agreement algorithm', async () => {
    await expect(
      service.decrypt(agentContext, {
        key: {},
        decryption: { algorithm: 'HPKE' },
        encrypted: rfc9180A3.ciphertext,
      } as unknown as Kms.KmsDecryptOptions)
    ).rejects.toThrow(
      `Decryption algorithm 'HPKE' can only be used with an integrated-encryption HPKE key agreement algorithm`
    )
  })

  it('does not support HPKE encryption without a matching HPKE key agreement algorithm', () => {
    expect(
      service.isOperationSupported(agentContext, {
        operation: 'encrypt',
        encryption: { algorithm: 'HPKE' },
        keyAgreement: {
          algorithm: 'ECDH-ES',
          keyId: 'key-1',
          externalPublicJwk: { kty: 'EC', crv: 'P-256', x: '', y: '' },
        },
      })
    ).toBe(false)

    expect(
      service.isOperationSupported(agentContext, {
        operation: 'encrypt',
        encryption: { algorithm: 'HPKE' },
      })
    ).toBe(false)
  })

  it('does not support an HPKE key agreement algorithm with a non-HPKE content encryption algorithm', () => {
    expect(
      service.isOperationSupported(agentContext, {
        operation: 'encrypt',
        encryption: { algorithm: 'A128GCM' },
        keyAgreement: { algorithm: 'HPKE-0', externalPublicJwk: { kty: 'EC', crv: 'P-256', x: '', y: '' } },
      } as unknown as Kms.KmsOperation)
    ).toBe(false)
  })
})
