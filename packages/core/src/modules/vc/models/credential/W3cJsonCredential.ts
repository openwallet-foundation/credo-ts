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

  /**
   * Data model 1.1 only. Always present when the credential uses the data model 1.1 context.
   */
  issuanceDate?: string

  /**
   * Data model 1.1 only.
   */
  expirationDate?: string

  /**
   * Data model 2.0 only. Replaces {@link issuanceDate}.
   */
  validFrom?: string

  /**
   * Data model 2.0 only. Replaces {@link expirationDate}.
   */
  validUntil?: string

  credentialSubject: SingleOrArray<W3cJsonCredentialSubject>
  [key: string]: unknown
}
