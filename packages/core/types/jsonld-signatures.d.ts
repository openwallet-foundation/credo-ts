/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '@digitalcredentials/jsonld-signatures' {
  export const suites: {
    LinkedDataSignature: any
    LinkedDataProof: any
  }

  export const purposes: {
    AssertionProofPurpose: any
  }

  export const constants: any

  // export default suites
}
