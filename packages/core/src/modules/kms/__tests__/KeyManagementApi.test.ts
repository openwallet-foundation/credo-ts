import { NodeKeyManagementService, NodeInMemoryKeyManagementStorage } from '../../../../../node/src'
import { getInMemoryAgentOptions } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { ValibotValidationError } from '../../../error/ValibotValidationError'
import { KeyManagementModule } from '../KeyManagementModule'
import { KeyManagementError } from '../error/KeyManagementError'

const agentOptions = getInMemoryAgentOptions('KeyManagementApi', undefined, {
  keyManagement: new KeyManagementModule({
    backends: [new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage())],
    defaultBackend: 'node',
  }),
})
const agent = new Agent(agentOptions)

describe('KeyManagementApi', () => {
  beforeAll(async () => {
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  test('throws error if invalid backend provided', async () => {
    await expect(
      agent.modules.keyManagement.getPublicKey({
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
    const result = await agent.modules.keyManagement.createKey({
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

    const publicJwk = await agent.modules.keyManagement.getPublicKey({
      keyId: 'hello',
    })
    expect(publicJwk).toEqual(result.publicJwk)

    const deleted = await agent.modules.keyManagement.deleteKey({
      keyId: 'hello',
    })
    expect(deleted).toEqual(true)

    const deleted2 = await agent.modules.keyManagement.deleteKey({
      keyId: 'hello',
    })
    expect(deleted2).toEqual(false)
  })

  test('throws error on invalid input for createKey', async () => {
    await expect(
      agent.modules.keyManagement.createKey({
        keyId: 'hello',
        type: {
          kty: 'EC',
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          crv: 'P-something',
        },
      })
    ).rejects.toThrow(ValibotValidationError)
  })

  test('throws error on invalid input for getPublicKey', async () => {
    await expect(
      agent.modules.keyManagement.getPublicKey({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        keyId: undefined,
      })
    ).rejects.toThrow(ValibotValidationError)
  })

  test('throws error on invalid input for deleteKey', async () => {
    await expect(
      agent.modules.keyManagement.getPublicKey({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        keyId: undefined,
      })
    ).rejects.toThrow(ValibotValidationError)
  })

  test('successfully sign and verify with key', async () => {
    const { keyId, publicJwk } = await agent.modules.keyManagement.createKey({
      type: {
        kty: 'EC',
        crv: 'P-256',
      },
    })

    const { signature } = await agent.modules.keyManagement.sign({
      keyId,
      algorithm: 'ES256',
      data: new Uint8Array([1, 2, 3]),
    })

    const verifyResult = await agent.modules.keyManagement.verify({
      key: keyId,
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
      agent.modules.keyManagement.sign({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        keyId: undefined,
      })
    ).rejects.toThrow(ValibotValidationError)
  })

  test('throws error on invalid input to verify', async () => {
    await expect(
      agent.modules.keyManagement.verify({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        key: undefined,
      })
    ).rejects.toThrow(ValibotValidationError)
  })
})
