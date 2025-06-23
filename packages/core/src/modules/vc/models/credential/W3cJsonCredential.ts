import type { JsonObject, SingleOrArray } from '../../../../types'

import type { W3cCredentialStatusOptions } from './w3c-credential-status/W3cCredentialStatus'

export interface W3cJsonCredential {
  '@context': Array<string | JsonObject>
  id?: string
  type: Array<string>
  issuer: string | { id?: string }
  issuanceDate: string
  expirationDate?: string
  credentialSubject: SingleOrArray<JsonObject>
  credentialStatus?: SingleOrArray<W3cCredentialStatusOptions>
  [key: string]: unknown
}
