import { NodeInMemoryKeyManagementStorage, NodeKeyManagementService } from '../../../../../node/src'
import { getAgentOptions } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { ZodValidationError } from '../../../error/ZodValidationError'
import { KeyManagementError } from '../error/KeyManagementError'
import { KeyManagementApi } from '../KeyManagementApi'
import { KeyManagementModuleConfig } from '../KeyManagementModuleConfig'
import type { KeyManagementService } from '../KeyManagementService'
import type { KmsJwkPublicEcdh, KmsOperation } from '../options'

const agentOptions = getAgentOptions('KeyManagementApi')
const agent = new Agent(agentOptions)

describe('KeyManagementApi', () => {
  beforeAll(async () => {
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  test('throws error if invalid backend provided', async () => {
    await expect(
      agent.kms.getPublicKey({
        keyId: 'hello',
        backend: 'non-existing',
      })
    ).rejects.toThrow(
      new KeyManagementError(
        `No key management service is configured for backend 'non-existing'. Available backends are 'node'`
      )
    )
  })

  test('successfully create, get and delete a key', async () => {
    const result = await agent.kms.createKey({
      keyId: 'hello',
      type: {
        kty: 'EC',
        crv: 'P-256',
      },
    })

    expect(result).toEqual({
      keyId: 'hello',
      publicJwk: {
        kid: 'hello',
        kty: 'EC',
        crv: 'P-256',
        x: expect.any(String),
        y: expect.any(String),
      },
    })

    const publicJwk = await agent.kms.getPublicKey({
      keyId: 'hello',
    })
    expect(publicJwk).toEqual(result.publicJwk)

    const deleted = await agent.kms.deleteKey({
      keyId: 'hello',
    })
    expect(deleted).toEqual(true)

    const deleted2 = await agent.kms.deleteKey({
      keyId: 'hello',
    })
    expect(deleted2).toEqual(false)
  })

  test('throws error on invalid input for createKey', async () => {
    await expect(
      agent.kms.createKey({
        keyId: 'hello',
        type: {
          kty: 'EC',

          // @ts-expect-error
          crv: 'P-something',
        },
      })
    ).rejects.toThrow(ZodValidationError)
  })

  test('throws error on invalid input for getPublicKey', async () => {
    await expect(
      agent.kms.getPublicKey({
        // @ts-expect-error
        keyId: undefined,
      })
    ).rejects.toThrow(ZodValidationError)
  })

  test('throws error on invalid input for deleteKey', async () => {
    await expect(
      agent.kms.getPublicKey({
        // @ts-expect-error
        keyId: undefined,
      })
    ).rejects.toThrow(ZodValidationError)
  })

  test('successfully sign and verify with key', async () => {
    const { keyId, publicJwk } = await agent.kms.createKey({
      type: {
        kty: 'EC',
        crv: 'P-256',
      },
    })

    const { signature } = await agent.kms.sign({
      keyId,
      algorithm: 'ES256',
      data: new Uint8Array([1, 2, 3]),
    })

    const verifyResult = await agent.kms.verify({
      key: {
        keyId,
      },
      algorithm: 'ES256',
      signature,
      data: new Uint8Array([1, 2, 3]),
    })
    expect(verifyResult).toEqual({
      verified: true,
      publicJwk,
    })
  })

  test('throws error on invalid input to sign', async () => {
    await expect(
      agent.kms.sign({
        // @ts-expect-error
        keyId: undefined,
      })
    ).rejects.toThrow(ZodValidationError)
  })

  test('throws error on invalid input to verify', async () => {
    await expect(
      agent.kms.verify({
        // @ts-expect-error
        key: undefined,
      })
    ).rejects.toThrow(ZodValidationError)
  })

  describe('supportedJwaSignatureAlgorithms', () => {
    test('does not return symmetric algorithms by default', () => {
      const supportedAlgorithms = agent.kms.supportedJwaSignatureAlgorithms()

      expect(supportedAlgorithms).toEqual(expect.arrayContaining(['ES256', 'EdDSA']))
      expect(supportedAlgorithms).not.toContain('HS256')
      expect(supportedAlgorithms).not.toContain('HS384')
      expect(supportedAlgorithms).not.toContain('HS512')
    })

    test('returns symmetric algorithms when includeSymmetricAlgorithms is true', () => {
      expect(agent.kms.supportedJwaSignatureAlgorithms({ includeSymmetricAlgorithms: true })).toEqual(
        expect.arrayContaining(['HS256', 'HS384', 'HS512', 'ES256', 'EdDSA'])
      )
    })

    test('only returns algorithms a backend can sign with', () => {
      const hmacAndEs256Backend = {
        backend: 'hmac-and-es256',
        isOperationSupported: (_agentContext: unknown, operation: KmsOperation) =>
          operation.operation === 'sign' && (operation.algorithm === 'ES256' || operation.algorithm.startsWith('HS')),
      } as unknown as KeyManagementService
      const kms = new KeyManagementApi(
        new KeyManagementModuleConfig({ backends: [hmacAndEs256Backend] }),
        agent.context
      )

      expect(kms.supportedJwaSignatureAlgorithms()).toEqual(['ES256'])
      expect(kms.supportedJwaSignatureAlgorithms({ includeSymmetricAlgorithms: true })).toEqual([
        'HS256',
        'HS384',
        'HS512',
        'ES256',
      ])
    })
  })

  test('getPublicKey returns the key from the provided backend', async () => {
    const otherBackend = Object.assign(new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage()), {
      backend: 'other',
    })
    const kms = new KeyManagementApi(
      new KeyManagementModuleConfig({
        backends: [new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage()), otherBackend],
      }),
      agent.context
    )

    await kms.createKey({ keyId: 'same-id', type: { kty: 'EC', crv: 'P-256' } })
    const otherKey = await kms.createKey({ keyId: 'same-id', backend: 'other', type: { kty: 'EC', crv: 'P-256' } })

    expect(await kms.getPublicKey({ keyId: 'same-id', backend: 'other' })).toEqual(otherKey.publicJwk)
  })

  test('encrypts, decrypts and verifies with keys that only exist in a backend that is not the default', async () => {
    const otherBackend = Object.assign(new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage()), {
      backend: 'other',
    })
    const kms = new KeyManagementApi(
      new KeyManagementModuleConfig({
        backends: [new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage()), otherBackend],
      }),
      agent.context
    )
    const data = new Uint8Array([1, 2, 3])

    const recipient = await kms.createKey({ backend: 'other', type: { kty: 'EC', crv: 'P-256' } })
    const agreement = await kms.encrypt({
      key: { keyAgreement: { algorithm: 'ECDH-ES', externalPublicJwk: recipient.publicJwk } },
      encryption: { algorithm: 'A256GCM' },
      data,
    })
    const agreementDecrypted = await kms.decrypt({
      key: {
        keyAgreement: {
          algorithm: 'ECDH-ES',
          keyId: recipient.keyId,
          ephemeralPublicJwk: agreement.ephemeralPublicJwk as KmsJwkPublicEcdh,
        },
      },
      decryption: { algorithm: 'A256GCM', iv: agreement.iv as Uint8Array, tag: agreement.tag as Uint8Array },
      encrypted: agreement.encrypted,
    })
    expect(Uint8Array.from(agreementDecrypted.data)).toEqual(data)

    const symmetric = await kms.createKey({ backend: 'other', type: { kty: 'oct', algorithm: 'aes', length: 256 } })
    const direct = await kms.encrypt({ key: { keyId: symmetric.keyId }, encryption: { algorithm: 'A256GCM' }, data })
    const directDecrypted = await kms.decrypt({
      key: { keyId: symmetric.keyId },
      decryption: { algorithm: 'A256GCM', iv: direct.iv as Uint8Array, tag: direct.tag as Uint8Array },
      encrypted: direct.encrypted,
    })
    expect(Uint8Array.from(directDecrypted.data)).toEqual(data)

    const signingKey = await kms.createKey({ backend: 'other', type: { kty: 'EC', crv: 'P-256' } })
    const { signature } = await kms.sign({ keyId: signingKey.keyId, algorithm: 'ES256', data })
    await expect(
      kms.verify({ key: { keyId: signingKey.keyId }, algorithm: 'ES256', data, signature })
    ).resolves.toMatchObject({ verified: true })
  })

  test('routes ECDH-1PU+A256KW to the backend that holds the sender key', async () => {
    const defaultBackend = new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage())
    const otherBackend = Object.assign(new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage()), {
      backend: 'other',
    })
    const kms = new KeyManagementApi(
      new KeyManagementModuleConfig({ backends: [defaultBackend, otherBackend] }),
      agent.context
    )
    const sender = await kms.createKey({ backend: 'other', type: { kty: 'OKP', crv: 'X25519' } })
    const recipient = await kms.createKey({ type: { kty: 'OKP', crv: 'X25519' } })
    const defaultEncrypt = vi.spyOn(defaultBackend, 'encrypt')
    const otherEncrypt = vi.spyOn(otherBackend, 'encrypt')

    await kms.encrypt({
      key: {
        keyAgreement: {
          algorithm: 'ECDH-1PU+A256KW',
          keyId: sender.keyId,
          recipients: [{ externalPublicJwk: recipient.publicJwk }],
        },
      },
      encryption: { algorithm: 'A256CBC-HS512' },
      data: new Uint8Array([1, 2, 3]),
    })

    expect(otherEncrypt).toHaveBeenCalledTimes(1)
    expect(defaultEncrypt).not.toHaveBeenCalled()
  })

  describe('rejects invalid ECDH options', () => {
    const x25519 = { kty: 'OKP', crv: 'X25519', x: 'hSDwCYkwp1R0i33ctD73Wg2_Og0mOBr066SpjqqbTmo' } as const
    const p256 = {
      kty: 'EC',
      crv: 'P-256',
      x: 'gI0GAILBdu7T53akrFmMyGcsF3n5dO7MmwNBHKW5SV0',
      y: 'SLW_xSffzlPWrHEVI30DHM_4egVwt3NQqeUD7nMFpps',
    } as const
    const data = new Uint8Array([1, 2, 3])

    test.each([
      {
        case: 'recipients on different curves',
        message: 'All recipient keys must have the same key type and curve',
        call: () =>
          agent.kms.encrypt({
            key: {
              keyAgreement: {
                algorithm: 'ECDH-ES+A256KW',
                recipients: [{ externalPublicJwk: x25519 }, { externalPublicJwk: p256 }],
              },
            },
            encryption: { algorithm: 'A256GCM' },
            data,
          }),
      },
      {
        case: 'ECDH-1PU+A256KW with A256GCM',
        message: `'encryption.algorithm' must be one of A128CBC-HS256, A192CBC-HS384, A256CBC-HS512`,
        call: () =>
          agent.kms.encrypt({
            key: {
              keyAgreement: {
                algorithm: 'ECDH-1PU+A256KW',
                keyId: 'sender',
                recipients: [{ externalPublicJwk: x25519 }],
              },
            },
            encryption: { algorithm: 'A256GCM' },
            data,
          }),
      },
      {
        case: 'ECDH-ES with A256CBC',
        message: `for key agreement algorithm 'ECDH-ES'`,
        call: () =>
          agent.kms.encrypt({
            key: { keyAgreement: { algorithm: 'ECDH-ES', externalPublicJwk: x25519 } },
            encryption: { algorithm: 'A256CBC' },
            data,
          }),
      },
      {
        case: 'ECDH-ES with an ephemeral keyId',
        message: /unrecognized key.*"keyId"/i,
        call: () =>
          agent.kms.encrypt({
            key: {
              keyAgreement: {
                algorithm: 'ECDH-ES',
                // @ts-expect-error the KMS now creates the ephemeral key
                keyId: 'ephemeral',
                externalPublicJwk: x25519,
              },
            },
            encryption: { algorithm: 'A256GCM' },
            data,
          }),
      },
      {
        case: 'ECDH-ES with an iv',
        message: `'encryption.iv' cannot be provided with ECDH key agreement`,
        call: () =>
          agent.kms.encrypt({
            key: { keyAgreement: { algorithm: 'ECDH-ES', externalPublicJwk: x25519 } },
            encryption: { algorithm: 'A256GCM', iv: new Uint8Array(12) },
            data,
          }),
      },
      {
        case: 'an aad callback without key agreement',
        message: `'encryption.aad' can only be a callback with ECDH key agreement`,
        call: () =>
          agent.kms.encrypt({
            key: { keyId: 'symmetric' },
            encryption: { algorithm: 'A256GCM', aad: () => data },
            data,
          }),
      },
      {
        case: 'decrypting ECDH-ES with A256CBC',
        message: `'decryption.algorithm' must be one of A128CBC-HS256`,
        call: () =>
          agent.kms.decrypt({
            key: { keyAgreement: { algorithm: 'ECDH-ES', keyId: 'recipient', ephemeralPublicJwk: x25519 } },
            decryption: { algorithm: 'A256CBC', iv: new Uint8Array(16) },
            encrypted: data,
          }),
      },
      {
        case: 'decrypting ECDH-1PU+A256KW with A256GCM',
        message: `'decryption.algorithm' must be one of A128CBC-HS256, A192CBC-HS384, A256CBC-HS512`,
        call: () =>
          agent.kms.decrypt({
            key: {
              keyAgreement: {
                algorithm: 'ECDH-1PU+A256KW',
                keyId: 'recipient',
                ephemeralPublicJwk: x25519,
                senderPublicJwk: x25519,
                encryptedKey: { encrypted: data },
              },
            },
            decryption: { algorithm: 'A256GCM', iv: new Uint8Array(12), tag: new Uint8Array(16) },
            encrypted: data,
          }),
      },
    ])('$case', async ({ call, message }) => {
      await expect(call()).rejects.toThrow(message)
    })

    test('supportedBackendsForOperation returns no backends for content encryption that encrypt rejects', () => {
      expect(
        agent.kms.supportedBackendsForOperation({
          operation: 'encrypt',
          encryption: { algorithm: 'A256CBC-HS512' },
          keyAgreement: { algorithm: 'ECDH-1PU+A256KW', recipients: [{ externalPublicJwk: x25519 }] },
        })
      ).toEqual(['node'])
      expect(
        agent.kms.supportedBackendsForOperation({
          operation: 'encrypt',
          encryption: { algorithm: 'A256GCM' },
          keyAgreement: { algorithm: 'ECDH-1PU+A256KW', recipients: [{ externalPublicJwk: x25519 }] },
        })
      ).toEqual([])
      expect(
        agent.kms.supportedBackendsForOperation({
          operation: 'encrypt',
          encryption: { algorithm: 'A256CBC' },
          keyAgreement: { algorithm: 'ECDH-ES', externalPublicJwk: x25519 },
        })
      ).toEqual([])
    })

    test('supportedBackendsForOperation returns no backends for content decryption that decrypt rejects', () => {
      const keyAgreement = {
        algorithm: 'ECDH-1PU+A256KW',
        ephemeralPublicJwk: x25519,
        senderPublicJwk: x25519,
        encryptedKey: { encrypted: data },
      } as const

      expect(
        agent.kms.supportedBackendsForOperation({
          operation: 'decrypt',
          decryption: { algorithm: 'A256CBC-HS512', iv: new Uint8Array(16), tag: new Uint8Array(32) },
          keyAgreement,
        })
      ).toEqual(['node'])
      expect(
        agent.kms.supportedBackendsForOperation({
          operation: 'decrypt',
          decryption: { algorithm: 'A256GCM', iv: new Uint8Array(12), tag: new Uint8Array(16) },
          keyAgreement,
        })
      ).toEqual([])
    })
  })

  describe('hpke', () => {
    test('encrypt and decrypt with HPKE-0', async () => {
      const { keyId, publicJwk } = await agent.kms.createKey({
        keyId: 'hpke-api',
        type: { kty: 'EC', crv: 'P-256' },
      })

      const info = new Uint8Array([1, 2, 3])
      const data = new Uint8Array([4, 5, 6])

      const { encrypted, encapsulatedKey } = await agent.kms.encrypt({
        key: { keyAgreement: { algorithm: 'HPKE-0', externalPublicJwk: publicJwk, info } },
        encryption: { algorithm: 'HPKE' },
        data,
      })
      expect(encapsulatedKey).toBeDefined()

      const decrypted = await agent.kms.decrypt({
        key: { keyAgreement: { algorithm: 'HPKE-0', keyId, encapsulatedKey: encapsulatedKey as Uint8Array, info } },
        decryption: { algorithm: 'HPKE' },
        encrypted,
      })
      expect(decrypted.data).toEqual(data)
    })

    test('throws when a content encryption algorithm is provided for an integrated HPKE algorithm', async () => {
      const { publicJwk } = await agent.kms.createKey({
        keyId: 'hpke-api-encryption',
        type: { kty: 'EC', crv: 'P-256' },
      })

      await expect(
        agent.kms.encrypt({
          key: { keyAgreement: { algorithm: 'HPKE-0', externalPublicJwk: publicJwk } },
          encryption: { algorithm: 'A128GCM' },
          data: new Uint8Array([1]),
        })
      ).rejects.toThrow(ZodValidationError)
    })

    test(`throws when encryption algorithm 'HPKE' is used without an HPKE key agreement algorithm`, async () => {
      await expect(
        agent.kms.encrypt({
          key: { keyId: 'hpke-api-encryption' },
          encryption: { algorithm: 'HPKE' },
          data: new Uint8Array([1]),
        })
      ).rejects.toThrow(ZodValidationError)
    })

    test('throws when encryption is missing', async () => {
      await expect(
        agent.kms.encrypt({
          key: { keyId: 'hpke-api-encryption' },
          // @ts-expect-error encryption is required
          encryption: undefined,
          data: new Uint8Array([1]),
        })
      ).rejects.toThrow(ZodValidationError)
    })
  })
})
