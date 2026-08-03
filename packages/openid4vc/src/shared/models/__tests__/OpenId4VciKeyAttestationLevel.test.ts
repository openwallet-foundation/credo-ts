import { keyAttestationLevelSatisfies } from '../OpenId4VciKeyAttestationLevel'

describe('keyAttestationLevelSatisfies', () => {
  test('a stronger attested level satisfies a weaker required level', () => {
    expect(keyAttestationLevelSatisfies(['iso_18045_moderate'], ['iso_18045_high'])).toBe(true)
    expect(keyAttestationLevelSatisfies(['iso_18045_basic'], ['iso_18045_enhanced-basic'])).toBe(true)
  })

  test('an equal attested level satisfies the required level', () => {
    expect(keyAttestationLevelSatisfies(['iso_18045_high'], ['iso_18045_high'])).toBe(true)
  })

  test('a weaker attested level does not satisfy a stronger required level', () => {
    expect(keyAttestationLevelSatisfies(['iso_18045_high'], ['iso_18045_moderate'])).toBe(false)
  })

  test('is satisfied if any attested value meets or exceeds any required value', () => {
    // required includes `basic`, attested `moderate` exceeds it
    expect(keyAttestationLevelSatisfies(['iso_18045_high', 'iso_18045_basic'], ['iso_18045_moderate'])).toBe(true)
    // attested includes `high` which satisfies the required `moderate`
    expect(keyAttestationLevelSatisfies(['iso_18045_moderate'], ['iso_18045_basic', 'iso_18045_high'])).toBe(true)
  })

  test('returns false when no attested levels are provided', () => {
    expect(keyAttestationLevelSatisfies(['iso_18045_basic'], undefined)).toBe(false)
    expect(keyAttestationLevelSatisfies(['iso_18045_basic'], [])).toBe(false)
  })

  test('custom (non-ISO) values are only matched exactly', () => {
    expect(keyAttestationLevelSatisfies(['custom_level'], ['custom_level'])).toBe(true)
    expect(keyAttestationLevelSatisfies(['custom_level'], ['iso_18045_high'])).toBe(false)
    expect(keyAttestationLevelSatisfies(['iso_18045_basic'], ['custom_level'])).toBe(false)
  })
})
