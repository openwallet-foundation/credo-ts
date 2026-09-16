import { CredoError, JsonTransformer, W3cCredential, W3cV2Credential } from '@credo-ts/core'
import { assertAndSetCredentialSubjectId } from '../credentialSubject'

const v1CredentialJson = {
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  type: ['VerifiableCredential'],
  issuer: 'did:example:issuer',
  issuanceDate: '2024-01-01T00:00:00Z',
  credentialSubject: { name: 'John' },
}

const v2CredentialJson = {
  '@context': ['https://www.w3.org/ns/credentials/v2'],
  type: ['VerifiableCredential'],
  issuer: 'did:example:issuer',
  validFrom: '2024-01-01T00:00:00Z',
  credentialSubject: { name: 'John' },
}

describe('assertAndSetCredentialSubjectId', () => {
  test('returns the credential untouched when no subject id is given', () => {
    const credential = JsonTransformer.fromJSON(v2CredentialJson, W3cV2Credential)

    expect(assertAndSetCredentialSubjectId(credential, undefined)).toBe(credential)
    expect(Array.isArray(credential.credentialSubject)).toBe(false)
    expect((credential.credentialSubject as { id?: string }).id).toBeUndefined()
  })

  test('sets the subject id when it is not yet set', () => {
    const credential = JsonTransformer.fromJSON(v2CredentialJson, W3cV2Credential)

    assertAndSetCredentialSubjectId(credential, 'did:example:holder')

    expect((credential.credentialSubject as { id?: string }).id).toBe('did:example:holder')
  })

  test('leaves a matching subject id in place', () => {
    const credential = JsonTransformer.fromJSON(
      { ...v2CredentialJson, credentialSubject: { id: 'did:example:holder', name: 'John' } },
      W3cV2Credential
    )

    assertAndSetCredentialSubjectId(credential, 'did:example:holder')

    expect((credential.credentialSubject as { id?: string }).id).toBe('did:example:holder')
  })

  test('throws when an existing subject id conflicts', () => {
    const credential = JsonTransformer.fromJSON(
      { ...v2CredentialJson, credentialSubject: { id: 'did:example:other', name: 'John' } },
      W3cV2Credential
    )

    expect(() => assertAndSetCredentialSubjectId(credential, 'did:example:holder')).toThrow(CredoError)
    expect(() => assertAndSetCredentialSubjectId(credential, 'did:example:holder')).toThrow(
      /does not match expected id/
    )
  })

  test('throws when the credential has multiple subjects', () => {
    const credential = JsonTransformer.fromJSON(
      { ...v2CredentialJson, credentialSubject: [{ name: 'John' }, { name: 'Jane' }] },
      W3cV2Credential
    )

    expect(() => assertAndSetCredentialSubjectId(credential, 'did:example:holder')).toThrow(
      /Cannot determine the subject/
    )
  })

  test('is generic over data model 1.1 credentials', () => {
    const credential = JsonTransformer.fromJSON(v1CredentialJson, W3cCredential)

    assertAndSetCredentialSubjectId(credential, 'did:example:holder')

    expect((credential.credentialSubject as { id?: string }).id).toBe('did:example:holder')
  })
})
