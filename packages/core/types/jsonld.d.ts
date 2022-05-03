/* eslint-disable */

declare module '@digitalcredentials/jsonld' {
  export const compact: (document: any, context: any, options?: any) => any
  export const fromRDF: (document: any) => any
  export const frame: (document: any, revealDocument: any, options?: any) => any
  export const canonize: (document: any, options?: any) => any
}
