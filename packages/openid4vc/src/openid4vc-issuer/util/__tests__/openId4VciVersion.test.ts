import { getOpenId4VciVersion } from '../openId4VciVersion'

describe('getOpenId4VciVersion', () => {
  test('uses the version of the session', () => {
    expect(getOpenId4VciVersion({ openId4VciVersion: 'v1.draft15' })).toBe('v1.draft15')
    expect(
      getOpenId4VciVersion({ openId4VciVersion: 'v1.draft11-14' }, { credentialConfigurationId: 'universityDegree' })
    ).toBe('v1.draft11-14')
  })

  test('falls back to the credential request for a session without a version', () => {
    expect(getOpenId4VciVersion({}, { credentialConfigurationId: 'universityDegree' })).toBe('v1')
    expect(getOpenId4VciVersion({}, {})).toBe('v1.draft11-14')
  })

  test('counts a session without a version as draft 11 to 14 when there is no credential request', () => {
    expect(getOpenId4VciVersion({})).toBe('v1.draft11-14')
  })
})
