import type { JsonObject, JsonValue } from '../types'
import type { SingleOrArray } from './type'

export type JsonLdDoc = Record<string, unknown>
export interface VerificationMethod extends JsonObject {
  id: string
  [key: string]: JsonValue
}

export interface Proof extends JsonObject {
  verificationMethod: string | VerificationMethod
  [key: string]: JsonValue
}

export interface DocumentLoaderResult {
  contextUrl?: string | null
  documentUrl: string
  document: JsonObject
}

export type DocumentLoader = (url: string) => Promise<DocumentLoaderResult>

export const orArrayToArray = <T>(val?: SingleOrArray<T>): Array<T> | undefined => {
  if (!val) return undefined
  if (Array.isArray(val)) return val
  return [val]
}

export const _includesContext = (options: { document: JsonLdDoc; contextUrl: string }) => {
  const context = options.document['@context']

  return context === options.contextUrl || (Array.isArray(context) && context.includes(options.contextUrl))
}
