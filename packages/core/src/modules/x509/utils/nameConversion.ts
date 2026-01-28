import { X509Error } from '../X509Error'
import type { X509CertificateIssuerAndSubjectOptions } from '../X509ServiceOptions'

export const convertName = (name: string | X509CertificateIssuerAndSubjectOptions) => {
  if (typeof name === 'string') return name

  let nameBuilder = ''

  if (name.commonName) nameBuilder = nameBuilder.concat(`CN=${name.commonName}, `)
  if (name.countryName) nameBuilder = nameBuilder.concat(`C=${name.countryName}, `)
  if (name.organizationalUnit) nameBuilder = nameBuilder.concat(`OU=${name.organizationalUnit}, `)
  if (name.stateOrProvinceName) nameBuilder = nameBuilder.concat(`ST=${name.stateOrProvinceName}, `)

  if (nameBuilder.length === 0) {
    throw new X509Error('Provided name object has no entries. Could not generate an issuer/subject name')
  }

  // Remove the trailing `, `
  return nameBuilder.slice(0, nameBuilder.length - 2)
}
