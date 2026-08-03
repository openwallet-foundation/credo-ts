import { CredoError } from '../../error'
import { tryParseDid } from '../dids/domain/parse'
import type { SingleValidationResult } from './models'

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
function normalizeDidIdentifier(identifier: string): string {
  return tryParseDid(identifier)?.did ?? identifier
}

/**
 * Validates whether the given `controller` (e.g. the controller of a verification method)
 * authenticates one of the provided `credentialSubjectIds`. This authenticates that the
 * presentation creator controls one of the credential subject ids.
 *
 * A credential subject id may reference a specific verification method (e.g.
 * `did:example:123#0`), while a verification method controller is always the bare DID
 * (`did:example:123`). Both refer to the same DID subject, so for DIDs the fragment (and
 * any DID URL parameters/path) is stripped before comparison. Non-DID identifiers (e.g.
 * UUIDs or HTTP URLs) are compared as-is.
 *
 * If the credential has no credential subject ids, the validation passes by default as
 * there is no subject to authenticate.
 *
 * NOTE: this doesn't take into account the case where the credentialSubject is not the
 * holder. In the future we can add support for other flows, but for now this is the most
 * common use case.
 */
export function validateCredentialSubjectAuthentication(
  credentialSubjectIds: string[],
  controller: string
): SingleValidationResult {
  const normalizedController = normalizeDidIdentifier(controller)
  const authenticatesCredentialSubject = credentialSubjectIds.some(
    (subjectId) => normalizeDidIdentifier(subjectId) === normalizedController
  )

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
