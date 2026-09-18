import { DidCommModuleConfig } from '../DidCommModuleConfig'

describe('DidCommModuleConfig', () => {
  describe('v2KeyAgreementCurve', () => {
    it("defaults to 'X25519'", () => {
      const config = new DidCommModuleConfig()
      expect(config.v2KeyAgreementCurve).toBe('X25519')
    })

    it("returns 'P-256' when configured with v2 enabled", () => {
      const config = new DidCommModuleConfig({ didcommVersions: ['v1', 'v2'], v2KeyAgreementCurve: 'P-256' })
      expect(config.v2KeyAgreementCurve).toBe('P-256')
    })

    it("returns 'X25519' when explicitly configured", () => {
      const config = new DidCommModuleConfig({ didcommVersions: ['v1', 'v2'], v2KeyAgreementCurve: 'X25519' })
      expect(config.v2KeyAgreementCurve).toBe('X25519')
    })

    it("throws when 'P-256' is set without v2 in didcommVersions", () => {
      expect(() => new DidCommModuleConfig({ v2KeyAgreementCurve: 'P-256' })).toThrow(
        /v2KeyAgreementCurve 'P-256' requires 'v2' in didcommVersions/
      )
    })

    it("throws when 'P-256' is set with only v1 in didcommVersions", () => {
      expect(() => new DidCommModuleConfig({ didcommVersions: ['v1'], v2KeyAgreementCurve: 'P-256' })).toThrow(
        /v2KeyAgreementCurve 'P-256' requires 'v2' in didcommVersions/
      )
    })

    it("returns 'P-384' when configured with v2 enabled", () => {
      const config = new DidCommModuleConfig({ didcommVersions: ['v1', 'v2'], v2KeyAgreementCurve: 'P-384' })
      expect(config.v2KeyAgreementCurve).toBe('P-384')
    })

    it("throws when 'P-384' is set without v2 in didcommVersions", () => {
      expect(() => new DidCommModuleConfig({ v2KeyAgreementCurve: 'P-384' })).toThrow(
        /v2KeyAgreementCurve 'P-384' requires 'v2' in didcommVersions/
      )
    })

    it("throws when 'P-384' is set with only v1 in didcommVersions", () => {
      expect(() => new DidCommModuleConfig({ didcommVersions: ['v1'], v2KeyAgreementCurve: 'P-384' })).toThrow(
        /v2KeyAgreementCurve 'P-384' requires 'v2' in didcommVersions/
      )
    })
  })

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
