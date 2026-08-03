// No type definitions available for this library
//@ts-expect-error
import jsonld from '@digitalcredentials/jsonld'

export interface JsonLd {
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  compact(document: any, context: any, options?: any): any
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  fromRDF(document: any): any
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  frame(document: any, revealDocument: any, options?: any): any
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  canonize(document: any, options?: any): any
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  expand(document: any, options?: any): any
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  getValues(document: any, key: string): any
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  addValue(document: any, key: string, value: any): void
}

export interface DocumentLoaderResult {
  contextUrl?: string | null
  documentUrl: string
  document: Record<string, unknown>
}

export type DocumentLoader = (url: string) => Promise<DocumentLoaderResult>

export default jsonld as unknown as JsonLd
