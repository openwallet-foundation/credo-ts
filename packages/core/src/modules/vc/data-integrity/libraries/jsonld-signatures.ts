// No type definitions available for this library
//@ts-ignore
import jsonLdSignatures from '@digitalcredentials/jsonld-signatures'
const { constants: JsonLdConstants, purposes: JsonLdPurposes, suites: JsonLdSuites } = jsonLdSignatures

export interface Suites {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  LinkedDataSignature: any
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  LinkedDataProof: any
}

export interface Purposes {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  AssertionProofPurpose: any
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  AuthenticationProofPurpose: any
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type Constants = any

export const suites = JsonLdSuites as Suites

export const purposes = JsonLdPurposes as Purposes

export const constants = JsonLdConstants as Constants
