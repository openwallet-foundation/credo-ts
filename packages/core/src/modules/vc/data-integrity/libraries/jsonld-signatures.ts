/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  constants as JsonLdConstants,
  purposes as JsonLdPurposes,
  suites as JsonLdSuites,
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
}

type Constants = any

export const suites = JsonLdSuites as Suites

export const purposes = JsonLdPurposes as Purposes

export const constants = JsonLdConstants as Constants
