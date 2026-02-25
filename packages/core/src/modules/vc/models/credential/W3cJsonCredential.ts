import type { JsonObject, SingleOrArray } from '../../../../types'

interface W3cJsonIssuer {
  id: string
  [key: string]: unknown
}

interface W3cJsonCredentialSubject {
  id?: string
  [key: string]: unknown
}

export interface W3cJsonCredential {
  '@context': Array<string | JsonObject>
  id?: string
  type: Array<string>
  issuer: string | W3cJsonIssuer
  issuanceDate: string
  expirationDate?: string
  credentialSubject: SingleOrArray<W3cJsonCredentialSubject>
  [key: string]: unknown
}
