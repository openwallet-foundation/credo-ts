import { validateCredentialSubjectAuthentication, w3cDate } from '../util'

describe('w3cDate', () => {
  test('formats a date without milliseconds', () => {
    expect(w3cDate('2020-01-01T00:00:00.123Z')).toBe('2020-01-01T00:00:00Z')
  })
})

describe('validateCredentialSubjectAuthentication', () => {
  // The did:jwk from the reported issue: subject id has a `#0` fragment while the
  // verification method controller is the bare did.
  const did =
    'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6IkVRRG5SRDdvcU1sTkxFRElNOFpjVTF0QTZDaWw2NG5lb3NHYUxMRTRibVUiLCJ5Ijoibkl2Wlc5TElMLXlUSllwcTVva0VvSGozMFhoU0tHM1hCZ2Nfd2U4cUdzZyJ9'

  test('matches a did credential subject id that has a fragment against the bare did controller', () => {
    expect(validateCredentialSubjectAuthentication([`${did}#0`], did)).toEqual({ isValid: true })
  })

  test('matches a did credential subject id without a fragment against the bare did controller', () => {
    expect(validateCredentialSubjectAuthentication([did], did)).toEqual({ isValid: true })
  })

  test('strips the fragment from the controller as well', () => {
    expect(validateCredentialSubjectAuthentication([did], `${did}#0`)).toEqual({ isValid: true })
  })

  test('does not match a different did', () => {
    const result = validateCredentialSubjectAuthentication([`${did}#0`], 'did:example:other')
    expect(result.isValid).toBe(false)
    expect(result.error).toBeInstanceOf(Error)
  })

  test('matches when at least one of multiple subject ids matches', () => {
    expect(validateCredentialSubjectAuthentication(['did:example:other#1', `${did}#0`], did)).toEqual({ isValid: true })
  })

  test('passes by default when there are no subject ids to authenticate', () => {
    expect(validateCredentialSubjectAuthentication([], did)).toEqual({ isValid: true })
  })

  // Non-did identifiers (UUIDs, HTTP URLs) are only normalized for dids, so they are
  // compared as-is. A fragment difference on a non-did identifier is therefore significant.
  test('compares non-did identifiers exactly (matching)', () => {
    const subject = 'urn:uuid:0c07c1ce-57cb-41af-bef2-1b932b986873'
    expect(validateCredentialSubjectAuthentication([subject], subject)).toEqual({ isValid: true })
  })

  test('does not strip the fragment from non-did http url identifiers', () => {
    const result = validateCredentialSubjectAuthentication(
      ['https://id.example/things#123'],
      'https://id.example/things'
    )
    expect(result.isValid).toBe(false)
    expect(result.error).toBeInstanceOf(Error)
  })
})
