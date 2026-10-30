import { X509Error } from '../X509Error'
import type { X509CertificateIssuerAndSubjectOptions } from '../X509ServiceOptions'

const ORGANIZATION_IDENTIFIER_OID = '2.5.4.97'

// RFC 4514 escaping, so a special character in a value can't change the structure of the name
const escapeNameValue = (value: string) => {
  // @peculiar/x509 can't parse an escaped backslash at the end of a value
  if (value.endsWith('\\')) {
    throw new X509Error(`Name value '${value}' can't end with a backslash`)
  }

  // A single pass, so a one-character value that is both leading and trailing is escaped once
  return value.replace(/[\\,+"<>;]|^[ #]| $/g, (character) => `\\${character}`)
}

export const convertName = (name: string | X509CertificateIssuerAndSubjectOptions) => {
  if (typeof name === 'string') return name

  // The order is kept stable, as it determines the encoded name that chains are matched on
  const attributes: Array<[string, string | undefined]> = [
    ['CN', name.commonName],
    ['C', name.countryName],
    ['O', name.organizationName],
    [ORGANIZATION_IDENTIFIER_OID, name.organizationIdentifier],
    ['OU', name.organizationalUnit],
    ['ST', name.stateOrProvinceName],
  ]

  const nameEntries = attributes.flatMap(([type, value]) => (value ? [`${type}=${escapeNameValue(value)}`] : []))

  if (nameEntries.length === 0) {
    throw new X509Error('Provided name object has no entries. Could not generate an issuer/subject name')
  }

  return nameEntries.join(', ')
}
