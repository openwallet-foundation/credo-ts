import type { JsonObject, SingleOrArray, W3cCredential, W3cV2Credential } from '@credo-ts/core'
import { CredoError, deepEquality } from '@credo-ts/core'

/**
 * Sets `credentialSubject.id` to `credentialSubjectId` when it is not already set, and asserts that an
 * already present id does not conflict with it.
 *
 * Returns the credential unchanged when no `credentialSubjectId` is given.
 */
export function assertAndSetCredentialSubjectId<Credential extends W3cCredential | W3cV2Credential>(
  credential: Credential,
  credentialSubjectId: string | undefined
): Credential {
  if (!credentialSubjectId) return credential

  if (Array.isArray(credential.credentialSubject)) {
    throw new CredoError('Invalid credential subject. Cannot determine the subject to set the subject id on.')
  }

  const existingId = credential.credentialSubject.id
  if (existingId && existingId !== credentialSubjectId) {
    throw new CredoError(`Credential subject id '${existingId}' does not match expected id '${credentialSubjectId}'.`)
  }

  if (!existingId) credential.credentialSubject.id = credentialSubjectId

  return credential
}

/**
 * Asserts that every claim of the offered credential subject is present in the received credential
 * subject with an equal value. The received subject MAY contain additional claims, as an issuer can
 * add claims that were only available at time of issuance.
 *
 * Claims are compared by presence rather than truthiness: `0`, `false` and `''` are legitimate claim
 * values. Numbers are compared by their string representation, as a claim value may be serialized
 * either way.
 */
export function assertCredentialSubjectMatchesOffer(
  offeredCredentialSubject: SingleOrArray<JsonObject>,
  receivedCredentialSubject: SingleOrArray<JsonObject>
) {
  if (Array.isArray(offeredCredentialSubject) || Array.isArray(receivedCredentialSubject)) {
    throw new CredoError('Invalid credential subject. Multiple credential subjects are not yet supported.')
  }

  const matches = Object.entries(offeredCredentialSubject).every(([claim, offeredValue]) => {
    const receivedValue = receivedCredentialSubject[claim]

    if (offeredValue === undefined || receivedValue === undefined) return false
    if (offeredValue === null || receivedValue === null) return offeredValue === receivedValue

    if (typeof offeredValue === 'number' || typeof receivedValue === 'number') {
      return offeredValue.toString() === receivedValue.toString()
    }

    return deepEquality(offeredValue, receivedValue)
  })

  if (!matches) {
    throw new CredoError(
      'Received invalid credential. Received credential subject does not match the offered credential subject.'
    )
  }
}
