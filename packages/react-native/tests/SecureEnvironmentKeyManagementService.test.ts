import { generateKeyPairSync } from 'node:crypto'
import { type BaseAgent, Kms, TypedArrayEncoder } from '@credo-ts/core'
import { expectTypeOf, vi } from 'vitest'
import { getAgentContext } from '../../core/tests/helpers'
import type { NodeKeyManagementService } from '../../node/src'
import {
  SecureEnvironmentKeyManagementService,
  type SecureEnvironmentUserAuthenticationOptions,
} from '../src/kms/SecureEnvironmentKeyManagementService'

const secureEnvironment = vi.hoisted(() => ({
  generateKeypair: vi.fn(),
  getPublicBytesForKeyId: vi.fn(),
  sign: vi.fn(),
  withUserAuthentication: vi.fn(),
  sessionSign: vi.fn(),
  KeyNotFoundError: class KeyNotFoundError extends Error {},
  KeyAlreadyExistsError: class KeyAlreadyExistsError extends Error {},
}))
vi.mock('@animo-id/expo-secure-environment', () => secureEnvironment)

// Uncompressed P-256 public key of a new key
function createPublicKeyBytes() {
  const { x, y } = generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey.export({ format: 'jwk' })
  return new Uint8Array([
    0x04,
    ...TypedArrayEncoder.fromBase64Url(x as string),
    ...TypedArrayEncoder.fromBase64Url(y as string),
  ])
}

describe('SecureEnvironmentKeyManagementService', () => {
  const agentContext = getAgentContext()
  const backend = new SecureEnvironmentKeyManagementService()
  // Typed like `agent.kms` of an agent with this backend registered
  const kms = new Kms.KeyManagementApi<[NodeKeyManagementService, SecureEnvironmentKeyManagementService]>(
    new Kms.KeyManagementModuleConfig({ backends: [backend] }),
    agentContext
  )

  beforeEach(() => {
    secureEnvironment.generateKeypair.mockReset()
    secureEnvironment.getPublicBytesForKeyId.mockReset().mockResolvedValue(createPublicKeyBytes())
    secureEnvironment.sign.mockReset().mockResolvedValue(new Uint8Array([1]))
    secureEnvironment.sessionSign.mockReset().mockResolvedValue(new Uint8Array([2]))
    // Runs the callback with a session
    secureEnvironment.withUserAuthentication
      .mockReset()
      .mockImplementation(async (callback) => callback({ sign: secureEnvironment.sessionSign }))
  })

  const sign = (keyId: string) =>
    kms.sign({ keyId, algorithm: 'ES256', data: new Uint8Array([0]), backend: 'secureEnvironment' })

  test('creates a key with the backend options of the secure environment', async () => {
    const backendOptions = {
      userAuthentication: { methods: ['biometric', 'deviceCredential'] },
      minimumKeyStorage: 'trustedEnvironment',
      attestationChallenge: new Uint8Array([1, 2, 3]),
    } satisfies Parameters<typeof kms.createKey>[0]['backendOptions']

    const key = await kms.createKey({
      keyId: 'key-1',
      type: { kty: 'EC', crv: 'P-256' },
      backend: 'secureEnvironment',
      backendOptions,
    })

    expect(key).toMatchObject({ keyId: 'key-1', publicJwk: { kty: 'EC', crv: 'P-256', kid: 'key-1' } })
    expect(secureEnvironment.generateKeypair).toHaveBeenCalledWith('key-1', backendOptions)
  })

  test('creates a key for a signature algorithm with the backend options of the secure environment', async () => {
    await kms.createKeyForSignatureAlgorithm({
      keyId: 'key-3',
      algorithm: 'ES256',
      backend: 'secureEnvironment',
      backendOptions: { userAuthentication: false },
    })

    expect(secureEnvironment.generateKeypair).toHaveBeenCalledWith('key-3', { userAuthentication: false })
  })

  test('creates a key with the defaults of the secure environment without backend options', async () => {
    await kms.createKey({ keyId: 'key-2', type: { kty: 'EC', crv: 'P-256' } })

    expect(secureEnvironment.generateKeypair).toHaveBeenCalledWith('key-2', undefined)
  })

  test('rejects backend options without a backend', async () => {
    await expect(
      // @ts-expect-error backend options require the backend they are for
      kms.createKey({ type: { kty: 'EC', crv: 'P-256' }, backendOptions: { minimumKeyStorage: 'strongBox' } })
    ).rejects.toThrow("'backendOptions' can only be provided together with 'backend'")
    expect(secureEnvironment.generateKeypair).not.toHaveBeenCalled()
  })

  test('types the backend options of the registered backends', () => {
    expectTypeOf<
      BaseAgent<{ kms: Kms.KeyManagementModule<[SecureEnvironmentKeyManagementService]> }>['kms']
    >().toEqualTypeOf<Kms.KeyManagementApi<[SecureEnvironmentKeyManagementService]>>()

    type CreateKeyOptions = Parameters<typeof kms.createKey>[0]
    expectTypeOf<{
      type: { kty: 'EC'; crv: 'P-256' }
      backend: 'secureEnvironment'
      backendOptions: { minimumKeyStorage: 'trustedEnvironment' }
    }>().toExtend<CreateKeyOptions>()
    // A backend without options, and a backend that is registered later
    expectTypeOf<{
      type: { kty: 'EC'; crv: 'P-256' }
      backend: 'node'
      backendOptions: { minimumKeyStorage: 'trustedEnvironment' }
    }>().not.toExtend<CreateKeyOptions>()
    expectTypeOf<{ type: { kty: 'EC'; crv: 'P-256' }; backend: 'other' }>().toExtend<CreateKeyOptions>()
  })

  describe('withUserAuthentication', () => {
    test('signs with the authentication while the callback runs, and asks for every signature after', async () => {
      const options: SecureEnvironmentUserAuthenticationOptions = { prompt: { title: 'Share 2 credentials' } }
      const signatures = await backend.withUserAuthentication(
        agentContext,
        async () => [await sign('key-1'), await sign('key-2')],
        options
      )

      expect(secureEnvironment.withUserAuthentication).toHaveBeenCalledWith(expect.any(Function), options)
      expect(signatures).toEqual([{ signature: new Uint8Array([2]) }, { signature: new Uint8Array([2]) }])
      expect(secureEnvironment.sessionSign).toHaveBeenCalledTimes(2)

      expect(await sign('key-1')).toEqual({ signature: new Uint8Array([1]) })
      expect(secureEnvironment.sign).toHaveBeenCalledWith('key-1', new Uint8Array([0]), { prompt: undefined })
    })

    test('only signs with the authentication for the given keys', async () => {
      const signatures = await backend.withUserAuthentication(
        agentContext,
        async () => [await sign('key-1'), await sign('other-key')],
        { keyIds: ['key-1'] }
      )

      expect(signatures).toEqual([{ signature: new Uint8Array([2]) }, { signature: new Uint8Array([1]) }])
      expect(secureEnvironment.sessionSign).toHaveBeenCalledWith('key-1', new Uint8Array([0]), { prompt: undefined })
      expect(secureEnvironment.sign).toHaveBeenCalledWith('other-key', new Uint8Array([0]), { prompt: undefined })
    })

    test('does not use the authentication for another agent context', async () => {
      const otherAgentContext = getAgentContext({ contextCorrelationId: 'other' })

      const signature = await backend.withUserAuthentication(agentContext, () =>
        backend.sign(otherAgentContext, { keyId: 'key-1', algorithm: 'ES256', data: new Uint8Array([0]) })
      )

      expect(signature).toEqual({ signature: new Uint8Array([1]) })
    })

    test('uses the configured prompt, also as default for withUserAuthentication', async () => {
      let language = 'en'
      const prompt = () => (language === 'en' ? { title: 'Sign' } : { title: 'Ondertekenen' })
      const promptBackend = new SecureEnvironmentKeyManagementService({ prompt })
      const signOptions = { keyId: 'key-1', algorithm: 'ES256', data: new Uint8Array([0]) } as const

      await promptBackend.sign(agentContext, signOptions)
      language = 'nl'
      await promptBackend.withUserAuthentication(agentContext, async () => {
        await promptBackend.sign(agentContext, signOptions)
      })
      await promptBackend.withUserAuthentication(agentContext, async () => {}, { prompt: { title: 'Share' } })

      expect(secureEnvironment.sign).toHaveBeenCalledWith('key-1', new Uint8Array([0]), { prompt: { title: 'Sign' } })
      expect(secureEnvironment.withUserAuthentication).toHaveBeenNthCalledWith(1, expect.any(Function), {
        prompt: { title: 'Ondertekenen' },
      })
      expect(secureEnvironment.sessionSign).toHaveBeenCalledWith('key-1', new Uint8Array([0]), {
        prompt: { title: 'Ondertekenen' },
      })
      expect(secureEnvironment.withUserAuthentication).toHaveBeenNthCalledWith(2, expect.any(Function), {
        prompt: { title: 'Share' },
      })
    })

    test('rejects a second user authentication while one is running for the agent context', async () => {
      await expect(
        backend.withUserAuthentication(agentContext, () =>
          backend.withUserAuthentication(agentContext, () => sign('key-1'))
        )
      ).rejects.toThrow("A user authentication of backend 'secureEnvironment' is already running for agent context")
    })
  })
})
