import {
  suites as JsonLdSuites,
  purposes as JsonLdPurposes,
  constants as JsonLdConstants,
  //@ts-ignore
} from '@digitalcredentials/jsonld-signatures'

interface Suites {
  LinkedDataSignature: any
  LinkedDataProof: any
}

interface Purposes {
  AssertionProofPurpose: any
}

type Constants = any

export const suites = JsonLdSuites as Suites

export const purposes = JsonLdPurposes as Purposes

export const constants = JsonLdConstants as Constants
