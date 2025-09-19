import type { JsonObject, SingleOrArray } from '../../../../types'

export interface W3cV2JsonCredential {
  '@context': Array<string | JsonObject>
  id?: string
  type: Array<string>
  name?: string | SingleOrArray<JsonObject>
  description?: string | SingleOrArray<JsonObject>
  issuer: string | { id: string; [property: string]: unknown }
  credentialSubject: SingleOrArray<JsonObject>
  validFrom?: string
  validUntil?: string
  status?: SingleOrArray<JsonObject>
  credentialSchema?: SingleOrArray<JsonObject>
  refreshService?: SingleOrArray<JsonObject>
  termsOfUse?: SingleOrArray<JsonObject>
  evidence?: SingleOrArray<JsonObject>
  [key: string]: unknown
}
