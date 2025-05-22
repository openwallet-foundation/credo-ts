import type { JsonObject, SingleOrArray } from '../../../../types'

export interface W3cJsonCredential {
  '@context': Array<string | JsonObject>
  id?: string
  type: Array<string>
  issuer: string | { id?: string }
  issuanceDate: string
  expirationDate?: string
  credentialSubject: SingleOrArray<JsonObject>
  [key: string]: unknown
}
