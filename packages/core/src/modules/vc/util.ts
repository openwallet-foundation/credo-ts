import { CredoError } from '../../error'
import { tryParseDid } from '../dids/domain/parse'
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
 * Returns the input unchanged if it is not a (parseable) DID.
 */
export function normalizeDidIdentifier(identifier: string): string {
  return tryParseDid(identifier)?.did ?? identifier
}

/**
 * Validates whether the presentation `signer` authenticates one of the provided `credentialSubjectIds`,
 * i.e. that the presentation creator controls one of the credential subject ids. Used for every
 * presentation format, so all of them apply the same rules.
 *
 * - A DID subject id matches when it is the signer DID. A DID URL subject id (e.g. `did:example:123#key-1`)
 *   matches only when it is also the verification method that signed, so `#key-2` does not authenticate it.
 * - Non-DID identifiers (e.g. UUIDs or HTTP URLs) are compared as-is.
 * - A credential without subject ids passes, as there is no subject to authenticate.
 *
 * NOTE: this doesn't take into account the case where the credentialSubject is not the
 * holder. In the future we can add support for other flows, but for now this is the most
 * common use case.
 *
 * @param signer the DID that signed the presentation, and the absolute id of the verification method it signed with
 */
export function validateCredentialSubjectAuthentication(
  credentialSubjectIds: string[],
  { signer, verificationMethodId }: Pick<ResolvedSigner, 'signer' | 'verificationMethodId'>
): SingleValidationResult {
  const authenticatesCredentialSubject = credentialSubjectIds.some((subjectId) => {
    const subjectDid = normalizeDidIdentifier(subjectId)
    return subjectDid === signer && (subjectDid === subjectId || subjectId === verificationMethodId)
  })

  if (credentialSubjectIds.length > 0 && !authenticatesCredentialSubject) {
    return {
      isValid: false,
      error: new CredoError(
        'Credential has one or more credentialSubject ids, but presentation does not authenticate credential subject'
      ),
    }
  }

  return {
    isValid: true,
  }
}
