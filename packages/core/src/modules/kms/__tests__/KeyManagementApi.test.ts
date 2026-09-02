import { getAgentOptions } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { ZodValidationError } from '../../../error/ZodValidationError'
import { KeyManagementError } from '../error/KeyManagementError'

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
