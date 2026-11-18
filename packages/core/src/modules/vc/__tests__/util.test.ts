import { validateCredentialSubjectAuthentication, w3cDate } from '../util'

describe('w3cDate', () => {
  test('formats a date without milliseconds', () => {
    expect(w3cDate('2020-01-01T00:00:00.123Z')).toBe('2020-01-01T00:00:00Z')
  })
})

describe('validateCredentialSubjectAuthentication', () => {
  // The did:jwk from the reported issue, whose credentialSubject.id has a `#0` fragment
  const did =
    'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6IkVRRG5SRDdvcU1sTkxFRElNOFpjVTF0QTZDaWw2NG5lb3NHYUxMRTRibVUiLCJ5Ijoibkl2Wlc5TElMLXlUSllwcTVva0VvSGozMFhoU0tHM1hCZ2Nfd2U4cUdzZyJ9'
  const signer = { signer: did, verificationMethodId: `${did}#0` }

  test('matches a did credential subject id against any verification method of the did', () => {
    expect(validateCredentialSubjectAuthentication([did], { signer: did, verificationMethodId: `${did}#1` })).toEqual({
      isValid: true,
    })
  })

  test('matches a did url credential subject id against the verification method it names', () => {
    expect(validateCredentialSubjectAuthentication([`${did}#0`], signer)).toEqual({ isValid: true })
  })

  test('does not match a did url credential subject id against another verification method of the did', () => {
    const result = validateCredentialSubjectAuthentication([`${did}#0`], {
      signer: did,
      verificationMethodId: `${did}#1`,
    })
    expect(result.isValid).toBe(false)
    expect(result.error).toBeInstanceOf(Error)
  })

  test('does not match a different did', () => {
    const result = validateCredentialSubjectAuthentication(['did:example:other#0'], signer)
    expect(result.isValid).toBe(false)
    expect(result.error).toBeInstanceOf(Error)
  })

  test('matches when at least one of multiple subject ids matches', () => {
    expect(validateCredentialSubjectAuthentication(['did:example:other#1', `${did}#0`], signer)).toEqual({
      isValid: true,
    })
  })

  test('passes by default when there are no subject ids to authenticate', () => {
    expect(validateCredentialSubjectAuthentication([], signer)).toEqual({ isValid: true })
  })

  test('does not match a non-did identifier against the signer', () => {
    const result = validateCredentialSubjectAuthentication(['urn:uuid:0c07c1ce-57cb-41af-bef2-1b932b986873'], signer)
    expect(result.isValid).toBe(false)
    expect(result.error).toBeInstanceOf(Error)
  })
})
