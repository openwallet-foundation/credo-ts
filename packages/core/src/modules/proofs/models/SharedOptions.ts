import type {
  IndyProposeProofFormat,
  IndyRequestProofFormat,
  IndyVerifyProofFormat,
} from '../formats/IndyProofFormatsServiceOptions'
import type { PresentationExchangeProposalFormat } from '../formats/PresentationExchangeFormatsServiceOptions'
import type { ProofRequest } from '../formats/indy/models/ProofRequest'
import type { RequestedCredentials, RequestedCredentialsOptions } from '../formats/indy/models/RequestedCredentials'
import type { RetrievedCredentials } from '../formats/indy/models/RetrievedCredentials'
import type { GetRequestedCredentialsConfig } from './GetRequestedCredentialsConfig'

export interface ProposeProofFormats {
  // If you want to propose an indy proof without attributes or
  // any of the other properties you should pass an empty object
  indy?: IndyProposeProofFormat
  presentationExchange?: PresentationExchangeProposalFormat // TBD
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

export interface RequestedCredentialConfigOptions {
  indy?: GetRequestedCredentialsConfig
  jsonLd?: never
}

export interface RetrievedCredentialOptions {
  indy?: RetrievedCredentials | undefined
  presentationExchange?: undefined
}

export interface ProofRequestFormats {
  indy?: ProofRequest | undefined
  jsonLd?: undefined
}

export interface RequestedCredentialsFormats {
  indy?: RequestedCredentials | undefined
  presentationExchange?: undefined
}

interface AcceptProposal {
  request: ProofRequest
}

export interface AutoSelectCredentialOptions {
  indy?: RetrievedCredentials | undefined
  jsonLd?: undefined
}
