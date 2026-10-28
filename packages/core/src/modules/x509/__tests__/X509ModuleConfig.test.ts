import { X509ModuleConfig } from '../X509ModuleConfig'
import {
  defaultX509RevocationCheckOptions,
  withX509RevocationCheckDefaults,
  X509RevocationCheckMode,
} from '../X509ValidationOptions'

describe('X509ModuleConfig revocationCheck', () => {
  test('uses the defaults when revocationCheck is not configured', () => {
    expect(new X509ModuleConfig().revocationCheck).toEqual(defaultX509RevocationCheckOptions)
    expect(new X509ModuleConfig({}).revocationCheck).toEqual(defaultX509RevocationCheckOptions)
  })

  test('uses the defaults for the options that are not configured', () => {
    expect(new X509ModuleConfig({ revocationCheck: { timeoutMs: 1000 } }).revocationCheck).toEqual({
      ...defaultX509RevocationCheckOptions,
      timeoutMs: 1000,
    })
  })

  test('uses the defaults for options configured as undefined', () => {
    const config = new X509ModuleConfig({ revocationCheck: { mode: undefined, checkFullChain: undefined } })

    expect(config.revocationCheck).toEqual(defaultX509RevocationCheckOptions)
  })

  test('uses the defaults again after revocationCheck is reset', () => {
    const config = new X509ModuleConfig({ revocationCheck: { mode: X509RevocationCheckMode.Disabled } })
    config.setRevocationCheck(undefined)

    expect(config.revocationCheck).toEqual(defaultX509RevocationCheckOptions)
  })

  test('only disables revocation checking when the mode is set to Disabled', () => {
    expect(new X509ModuleConfig({ revocationCheck: {} }).revocationCheck.mode).toBe(X509RevocationCheckMode.SoftFail)
    expect(
      new X509ModuleConfig({ revocationCheck: { mode: X509RevocationCheckMode.Disabled } }).revocationCheck.mode
    ).toBe(X509RevocationCheckMode.Disabled)
  })
})

describe('withX509RevocationCheckDefaults', () => {
  const base = { ...defaultX509RevocationCheckOptions, mode: X509RevocationCheckMode.Require, timeoutMs: 1000 }

  test('takes the options that are not set from the base', () => {
    expect(withX509RevocationCheckDefaults({ maxCrlSizeBytes: 10 }, base)).toEqual({ ...base, maxCrlSizeBytes: 10 })
  })

  test('takes options set to undefined from the base', () => {
    expect(withX509RevocationCheckDefaults({ mode: undefined, timeoutMs: undefined }, base)).toEqual(base)
  })
})
