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
})
