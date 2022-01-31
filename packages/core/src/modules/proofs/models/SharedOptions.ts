import type { ProofRequest, RequestedCredentials } from '..'
import type { IndyProposeProofFormat, IndyRequestProofFormat } from '../formats/IndyProofFormatsServiceOptions'

export interface ProposeProofFormats {
  // If you want to propose an indy proof without attributes or
  // any of the other properties you should pass an empty object
  indy?: IndyProposeProofFormat
  presentationExchange?: never // TBD
}

export interface RequestProofFormats {
  // If you want to propose an indy proof without attributes or
  // any of the other properties you should pass an empty object
  indy?: IndyRequestProofFormat
  presentationExchange?: never // TBD
}

export interface CreatePresentationFormats {
  // If you want to propose an indy proof without attributes or
  // any of the other properties you should pass an empty object
  indy?: RequestedCredentials
  presentationExchange?: never // TBD
}

export interface AcceptProposalFormats {
  // If you want to propose an indy proof without attributes or
  // any of the other properties you should pass an empty object
  indy?: AcceptProposal
  presentationExchange?: never // TBD
}

interface AcceptProposal {
  request: ProofRequest
}
