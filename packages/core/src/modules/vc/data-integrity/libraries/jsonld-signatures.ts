import {
  constants as JsonLdConstants,
  purposes as JsonLdPurposes,
  suites as JsonLdSuites,
  // No type definitions available for this library
  //@ts-ignore
} from '@digitalcredentials/jsonld-signatures'

export interface Suites {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  LinkedDataSignature: any
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  LinkedDataProof: any
}

export interface Purposes {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  AssertionProofPurpose: any
  AuthenticationProofPurpose: any
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type Constants = any

export const suites = JsonLdSuites as Suites

export const purposes = JsonLdPurposes as Purposes

export const constants = JsonLdConstants as Constants
