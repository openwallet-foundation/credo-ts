import type { RequestedCredentials } from '..'
import type {
  IndyPresentationProofFormat,
  IndyProposeProofFormat,
  IndyRequestProofFormat,
} from '../formats/IndyProofFormatsServiceOptions'

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
