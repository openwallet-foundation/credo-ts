import type { SingleOrArray } from './type'

export type JsonLdDoc = Record<string, unknown>
export interface VerificationMethod {
  id: string
  [key: string]: unknown
}

export interface Proof {
  verificationMethod: string | VerificationMethod
  [key: string]: unknown
}

export type DocumentLoaderResult = Promise<Record<string, unknown>>

export type DocumentLoader = (url: string) => DocumentLoaderResult

export const orArrayToArray = (val?: SingleOrArray<string>): Array<string> | undefined => {
  if (!val) return undefined
  if (Array.isArray(val)) return val
  return [val]
}

export const _includesContext = (options: { document: JsonLdDoc; contextUrl: string }) => {
  const context = options.document['@context']

  return context === options.contextUrl || (Array.isArray(context) && context.includes(options.contextUrl))
}
