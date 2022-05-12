/* eslint-disable */

import { JsonObject } from '../src/types'

export interface DocumentLoaderResult {
  contextUrl?: string | null
  documentUrl: string
  document: JsonObject
}

export type DocumentLoader = (url: string) => Promise<DocumentLoaderResult>

declare module '@digitalcredentials/jsonld' {
  export const compact: (document: any, context: any, options?: any) => any
  export const fromRDF: (document: any) => any
  export const frame: (document: any, revealDocument: any, options?: any) => any
  export const canonize: (document: any, options?: any) => any
  export const expand: (document: any, options?: any) => any
}

// declare module '@digitalcredentials/jsonld/lib/documentLoaders/xhr' {
//   const documentLoader: DocumentLoader
//   export default documentLoader
// }

// declare module '@digitalcredentials/jsonld/lib/documentLoaders/node' {
//   const documentLoader: DocumentLoader
//   export default documentLoader
// }
