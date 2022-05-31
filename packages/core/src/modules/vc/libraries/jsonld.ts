/* eslint-disable @typescript-eslint/no-explicit-any */

// No type definitions available for this library
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import jsonld from '@digitalcredentials/jsonld'
// No type definitions available for this library
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import nodeDocumentLoader from '@digitalcredentials/jsonld/lib/documentLoaders/node'
// No type definitions available for this library
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import xhrDocumentLoader from '@digitalcredentials/jsonld/lib/documentLoaders/xhr'

interface JsonLd {
  compact(document: any, context: any, options?: any): any
  fromRDF(document: any): any
  frame(document: any, revealDocument: any, options?: any): any
  canonize(document: any, options?: any): any
  expand(document: any, options?: any): any
  getValues(document: any, key: string): any
  addValue(document: any, key: string, value: any): void
}

export interface DocumentLoaderResult {
  contextUrl?: string | null
  documentUrl: string
  document: Record<string, unknown>
}

export type DocumentLoader = (url: string) => Promise<DocumentLoaderResult>

export const documentLoaderXhr = xhrDocumentLoader as () => DocumentLoader
export const documentLoaderNode = nodeDocumentLoader as () => DocumentLoader

export default jsonld as unknown as JsonLd
