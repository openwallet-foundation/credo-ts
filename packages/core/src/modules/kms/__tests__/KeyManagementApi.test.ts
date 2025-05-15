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
})
