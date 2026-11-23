import { CredoError } from '../../error'
import { isSameDidReference, parseDidReference, tryParseDid } from '../dids/domain/parse'
import type { SingleValidationResult } from './models'
import type { ResolvedSigner } from './resolveSigner'

/**
 * Formats an input date to w3c standard date format
 * @param date {number|string} Optional if not defined current date is returned
 *
 * @returns {string} date in a standard format as a string
 */
export const w3cDate = (date?: number | string): string => {
  let result = new Date()
  if (typeof date === 'number' || typeof date === 'string') {
    result = new Date(date)
  }
  const str = result.toISOString()
  return `${str.substr(0, str.length - 5)}Z`
}

/**
 * Returns the bare DID for a DID URL, stripping any fragment, query and path.
 * Returns the input unchanged if it is not a (parseable) DID. For picking a DID and the ids that refer to it, not
 * for matching a subject id to a key, which must compare parsed references (see
 * `validateCredentialSubjectAuthentication`).
 */
export function normalizeDidIdentifier(identifier: string): string {
  return tryParseDid(identifier)?.did ?? identifier
}

/**
 * Returns an error message when a `credentialSubject.id` is a DID URL that can't be used to authenticate the
 * credential subject, because it has a path, a query or an empty fragment.
 */
export function getCredentialSubjectIdProblem(credentialSubjectId: string): string | undefined {
  if (!tryParseDid(credentialSubjectId) || parseDidReference(credentialSubjectId)) return undefined

  return `To authenticate the credential subject, credentialSubject.id '${credentialSubjectId}' must be a DID, or a DID with a fragment that names a verification method in the current DID document, without a path or query`
}

/**
 * Validates whether the presentation `signer` authenticates one of the provided `credentialSubjectIds`,
 * i.e. that the presentation creator controls one of the credential subject ids. Used for every
 * presentation format, so all of them apply the same rules.
 *
 * - A DID subject id matches when it is the signer DID. A DID URL subject id (e.g. `did:example:123#key-1`)
 *   matches only when it is also the verification method that signed, so `#key-2` does not authenticate it.
 * - A DID URL subject id with a path, a query or an empty fragment never matches. The credential subject is
 *   always authenticated against the current DID document, and a query such as `versionId` would pin an earlier
 *   version, whose keys may since have been rotated out. DID Core allows a verification method id with a path,
 *   and a DID subject id is authenticated by such a method like any other, but a subject id that names one
 *   method must name it by fragment.
 * - Non-DID identifiers (e.g. UUIDs or HTTP URLs) are compared as-is.
 * - A credential without subject ids passes, as there is no subject to authenticate.
 *
 * NOTE: this doesn't take into account the case where the credentialSubject is not the
 * holder. In the future we can add support for other flows, but for now this is the most
 * common use case.
 *
 * @param signer the DID that signed the presentation, and the id of the verification method it signed with
 */
export function validateCredentialSubjectAuthentication(
  credentialSubjectIds: string[],
  { signer, verificationMethodId }: Pick<ResolvedSigner, 'signer' | 'verificationMethodId'>
): SingleValidationResult {
  const authenticatesCredentialSubject = credentialSubjectIds.some((subjectId) => {
    const reference = parseDidReference(subjectId)
    // A DID URL with a path, query or empty fragment never equals the signer, which is a DID
    if (!reference) return subjectId === signer
    if (reference.did !== signer) return false

    return reference.kind === 'did' || isSameDidReference(subjectId, verificationMethodId)
  })

  if (credentialSubjectIds.length > 0 && !authenticatesCredentialSubject) {
    const problem = credentialSubjectIds.map(getCredentialSubjectIdProblem).find((message) => message !== undefined)

    return {
      isValid: false,
      error: new CredoError(
        problem ??
          'Credential has one or more credentialSubject ids, but presentation does not authenticate credential subject'
      ),
    }
  }

  return {
    isValid: true,
  }
}
