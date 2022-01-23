import type { IndyProposeProofFormat } from '../protocol/v1/models/ProofFormatsInterfaces'

/**
 * Moved to protocol/v1/models
 */
// export interface IndyProposeProofFormat {
//   attributes?: PresentationPreviewAttribute[]
//   predicates?: PresentationPreviewPredicate[]
//   nonce: string
//   name: string
//   version: string
//   proofPreview?: PresentationPreview
// }

export interface ProposeProofFormats {
  // If you want to propose an indy proof without attributes or
  // any of the other properties you should pass an empty object
  indy?: IndyProposeProofFormat
  presentationExchange?: never // TBD
}
