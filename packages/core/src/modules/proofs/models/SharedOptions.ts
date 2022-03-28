import type {
  IndyProposeProofFormat,
  IndyRequestProofFormat,
  IndyVerifyProofFormat,
} from '../formats/IndyProofFormatsServiceOptions'
import type { ProofRequest } from '../formats/indy/models/ProofRequest'
import type { RequestedCredentialsOptions } from '../formats/indy/models/RequestedCredentials'

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
  indy?: RequestedCredentialsOptions
  presentationExchange?: never // TBD
}

export interface AcceptProposalFormats {
  // If you want to propose an indy proof without attributes or
  // any of the other properties you should pass an empty object
  indy?: AcceptProposal
  presentationExchange?: never // TBD
}

export interface VerifyProofFormats {
  indy?: IndyVerifyProofFormat
  presentationExchange?: never
}

interface AcceptProposal {
  request: ProofRequest
}
