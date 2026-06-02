import { DidCommModuleConfig } from '../DidCommModuleConfig'

describe('DidCommModuleConfig', () => {
  describe('v2 default content encryption', () => {
    test('defaults to A256CBC-HS512 for authcrypt', () => {
      const config = new DidCommModuleConfig()
      expect(config.v2DefaultAuthcryptContentEncryption).toBe('A256CBC-HS512')
    })

    test('defaults to A256CBC-HS512 for anoncrypt', () => {
      const config = new DidCommModuleConfig()
      expect(config.v2DefaultAnoncryptContentEncryption).toBe('A256CBC-HS512')
    })

    test('honors a configured anoncrypt override (A256GCM)', () => {
      const config = new DidCommModuleConfig({ v2DefaultAnoncryptContentEncryption: 'A256GCM' })
      expect(config.v2DefaultAnoncryptContentEncryption).toBe('A256GCM')
    })

    test('honors a configured anoncrypt override', () => {
      const config = new DidCommModuleConfig({ v2DefaultAnoncryptContentEncryption: 'XC20P' })
      expect(config.v2DefaultAnoncryptContentEncryption).toBe('XC20P')
    })
  })
})
