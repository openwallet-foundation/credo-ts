import type { Mock } from 'vitest'
import { vi } from 'vitest'
import { getAgentContext } from '../../../../tests/helpers'
import { KeyManagementApi } from '../KeyManagementApi'
import { KeyManagementModuleConfig } from '../KeyManagementModuleConfig'
import type { KeyManagementService } from '../KeyManagementService'

const createMockBackend = (backend: string, { isOperationSupported = true }: { isOperationSupported?: boolean } = {}) =>
  ({
    backend,
    isOperationSupported: vi.fn().mockReturnValue(isOperationSupported),
    createKey: vi.fn().mockImplementation(async () => ({
      keyId: `${backend}-key-id`,
      publicJwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
    })),
  }) as unknown as KeyManagementService & { createKey: Mock; isOperationSupported: Mock }

describe('KeyManagementApi backend selection', () => {
  const agentContext = getAgentContext()

  test('uses the first registered backend when no defaultBackend is configured', async () => {
    const backend1 = createMockBackend('backend1')
    const backend2 = createMockBackend('backend2')
    const kms = new KeyManagementApi(new KeyManagementModuleConfig({ backends: [backend1, backend2] }), agentContext)

    const key = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    expect(key.keyId).toEqual('backend1-key-id')
    expect(backend1.createKey).toHaveBeenCalled()
    expect(backend2.createKey).not.toHaveBeenCalled()
  })

  test('uses the configured defaultBackend when no explicit backend is provided', async () => {
    const backend1 = createMockBackend('backend1')
    const backend2 = createMockBackend('backend2')
    const kms = new KeyManagementApi(
      new KeyManagementModuleConfig({ backends: [backend1, backend2], defaultBackend: 'backend2' }),
      agentContext
    )

    const key = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    expect(key.keyId).toEqual('backend2-key-id')
    expect(backend2.createKey).toHaveBeenCalled()
    expect(backend1.createKey).not.toHaveBeenCalled()
  })

  test('uses the explicitly provided backend over the configured defaultBackend', async () => {
    const backend1 = createMockBackend('backend1')
    const backend2 = createMockBackend('backend2')
    const kms = new KeyManagementApi(
      new KeyManagementModuleConfig({ backends: [backend1, backend2], defaultBackend: 'backend2' }),
      agentContext
    )

    const key = await kms.createKey({ backend: 'backend1', type: { kty: 'EC', crv: 'P-256' } })

    expect(key.keyId).toEqual('backend1-key-id')
    expect(backend1.createKey).toHaveBeenCalled()
    expect(backend2.createKey).not.toHaveBeenCalled()
  })

  test('falls back to another backend when the defaultBackend does not support the operation', async () => {
    const backend1 = createMockBackend('backend1')
    const backend2 = createMockBackend('backend2', { isOperationSupported: false })
    const kms = new KeyManagementApi(
      new KeyManagementModuleConfig({ backends: [backend1, backend2], defaultBackend: 'backend2' }),
      agentContext
    )

    const key = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    expect(key.keyId).toEqual('backend1-key-id')
    expect(backend1.createKey).toHaveBeenCalled()
    expect(backend2.createKey).not.toHaveBeenCalled()
  })

  test('skips the key lookup when the other backends decline the key by its id', async () => {
    const mine = Object.assign(createMockBackend('mine'), {
      getPublicKey: vi.fn(),
      sign: vi.fn().mockResolvedValue({ signature: new Uint8Array() }),
      decrypt: vi.fn().mockResolvedValue({ data: new Uint8Array() }),
    })
    const other = Object.assign(createMockBackend('other'), { getPublicKey: vi.fn() })
    other.isOperationSupported.mockImplementation((_, operation) => operation.keyId !== 'my-key')
    const kms = new KeyManagementApi(new KeyManagementModuleConfig({ backends: [other, mine] }), agentContext)

    await kms.sign({ keyId: 'my-key', algorithm: 'ES256', data: new Uint8Array([1]) })
    await kms.decrypt({
      key: { keyId: 'my-key' },
      decryption: { algorithm: 'A256GCM', iv: new Uint8Array(12), tag: new Uint8Array(16) },
      encrypted: new Uint8Array([1]),
    })

    expect(mine.sign).toHaveBeenCalled()
    expect(mine.decrypt).toHaveBeenCalled()
    expect(mine.getPublicKey).not.toHaveBeenCalled()
    expect(other.getPublicKey).not.toHaveBeenCalled()

    await expect(
      kms.sign({ keyId: 'my-key', backend: 'other', algorithm: 'ES256', data: new Uint8Array([1]) })
    ).rejects.toThrow(
      "Key management service backend 'other' does not support 'sign' operation with algorithm 'ES256' and key 'my-key'"
    )
  })
})
