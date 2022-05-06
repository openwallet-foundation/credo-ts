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

/**
 * Gets the JSON-LD type information for a document
 * @param document {any} JSON-LD document to extract the type information from
 * @param options {GetTypeInfoOptions} Options for extracting the JSON-LD document
 *
 * @returns {object} Type info for the JSON-LD document
 */
export const getTypeInfo = async (document: any, options: GetTypeOptions): Promise<any> => {
  const { documentLoader, expansionMap } = options

  // determine `@type` alias, if any
  const context = jsonld.getValues(document, '@context')

  const compacted = await jsonld.compact({ '@type': '_:b0' }, context, {
    documentLoader,
    expansionMap,
  })

  delete compacted['@context']

  const alias = Object.keys(compacted)[0]

  // optimize: expand only `@type` and `type` values
  /* eslint-disable prefer-const */
  let toExpand: any = { '@context': context }
  toExpand['@type'] = jsonld.getValues(document, '@type').concat(jsonld.getValues(document, alias))

  const expanded = (await jsonld.expand(toExpand, { documentLoader, expansionMap }))[0] || {}

  return { types: jsonld.getValues(expanded, '@type'), alias }
}
