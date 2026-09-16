import type { W3cCredential, W3cV2Credential } from '@credo-ts/core'
import { CredoError } from '@credo-ts/core'

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
