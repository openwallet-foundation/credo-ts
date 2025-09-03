/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  suites as JsonLdSuites,
  purposes as JsonLdPurposes,
  constants as JsonLdConstants,
  // No type definitions available for this library
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
} from '@digitalcredentials/jsonld-signatures'

export interface Suites {
  LinkedDataSignature: any
  LinkedDataProof: any
}

export interface Purposes {
  AssertionProofPurpose: any
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  AuthenticationProofPurpose: any
}

type Constants = any

export const suites = JsonLdSuites as Suites

export const purposes = JsonLdPurposes as Purposes

export const constants = JsonLdConstants as Constants
