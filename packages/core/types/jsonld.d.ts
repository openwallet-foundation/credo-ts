/* eslint-disable */

declare module '@digitalcredentials/jsonld' {
  export const compact: (document: any, context: any, options?: any) => any
  export const fromRDF: (document: any) => any
  export const frame: (document: any, revealDocument: any, options?: any) => any
  export const canonize: (document: any, options?: any) => any
  export const expand: (document: any, options?: any) => any
  export const getValues: (document: any, key: string) => any
  export const addValue: (document: any, key: string, value: any) => void

  export interface DocumentLoaderResult {
    contextUrl?: string | null
    documentUrl: string
    document: Record<string, unknown>
  }

  export type DocumentLoader = (url: string) => Promise<DocumentLoaderResult>
}

declare module '@digitalcredentials/jsonld/lib/documentLoaders/xhr' {
  import { DocumentLoader } from '@digitalcredentials/jsonld'

  const documentLoader: () => DocumentLoader
  export default documentLoader
}

declare module '@digitalcredentials/jsonld/lib/documentLoaders/node' {
  import { DocumentLoader } from '@digitalcredentials/jsonld'

  const documentLoader: () => DocumentLoader
  export default documentLoader
}
