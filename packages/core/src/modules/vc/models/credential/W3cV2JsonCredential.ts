import type { JsonObject, SingleOrArray } from '../../../../types'

export interface W3cV2JsonLocalizedValue {
  '@value': string
  '@language'?: string | null
  '@direction'?: 'ltr' | 'rtl' | null
  [key: string]: unknown
}

interface W3cV2JsonIssuer {
  id: string
  [key: string]: unknown
}

interface W3cV2JsonCredentialSubject {
  id?: string
  [key: string]: unknown
}

interface W3cV2JsonStatus {
  id?: string
  type: string
  [key: string]: unknown
}

interface W3cV2JsonCredentialSchema {
  id: string
  type: string
  [key: string]: unknown
}

interface W3cV2JsonRefreshService {
  type: string
  [key: string]: unknown
}

interface W3cV2JsonTermsOfUse {
  type: string
  [key: string]: unknown
}

interface W3cV2JsonEvidence {
  id?: string
  type: string
  [key: string]: unknown
}

export interface W3cV2JsonCredential {
  '@context': Array<string | JsonObject>
  id?: string
  type: Array<string>
  name?: string | SingleOrArray<W3cV2JsonLocalizedValue>
  description?: string | SingleOrArray<W3cV2JsonLocalizedValue>
  issuer: string | W3cV2JsonIssuer
  credentialSubject: SingleOrArray<W3cV2JsonCredentialSubject>
  validFrom?: string
  validUntil?: string
  status?: SingleOrArray<W3cV2JsonStatus>
  credentialSchema?: SingleOrArray<W3cV2JsonCredentialSchema>
  refreshService?: SingleOrArray<W3cV2JsonRefreshService>
  termsOfUse?: SingleOrArray<W3cV2JsonTermsOfUse>
  evidence?: SingleOrArray<W3cV2JsonEvidence>
  [key: string]: unknown
}
