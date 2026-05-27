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
  })
})
