import { KeyManagementError } from '../error/KeyManagementError'
import { KeyManagementModuleConfig } from '../KeyManagementModuleConfig'
import type { KeyManagementService } from '../KeyManagementService'

const createMockBackend = (backend: string) => ({ backend }) as KeyManagementService

describe('KeyManagementModuleConfig', () => {
  test('defaultBackend returns the first registered backend when no defaultBackend is configured', () => {
    const backend1 = createMockBackend('backend1')
    const backend2 = createMockBackend('backend2')
    const config = new KeyManagementModuleConfig({ backends: [backend1, backend2] })

    expect(config.defaultBackend).toBe(backend1)
  })

  test('defaultBackend returns the configured defaultBackend', () => {
    const backend1 = createMockBackend('backend1')
    const backend2 = createMockBackend('backend2')
    const config = new KeyManagementModuleConfig({ backends: [backend1, backend2], defaultBackend: 'backend2' })

    expect(config.defaultBackend).toBe(backend2)
  })

  test('constructor throws when defaultBackend does not match a registered backend', () => {
    expect(
      () => new KeyManagementModuleConfig({ backends: [createMockBackend('backend1')], defaultBackend: 'backend2' })
    ).toThrow(KeyManagementError)
  })

  test('defaultBackend throws when no backends are registered', () => {
    const config = new KeyManagementModuleConfig({})

    expect(() => config.defaultBackend).toThrow(KeyManagementError)
  })
})
