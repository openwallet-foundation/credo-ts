import type { IndyProposeProofFormat } from '../formats/indy/IndyProofFormat'
import type { IndyRequestProofFormat, IndyVerifyProofFormat } from '../formats/indy/IndyProofFormatsServiceOptions'
import type { ProofRequest } from '../formats/indy/models/ProofRequest'
import type { RequestedCredentials, IndyRequestedCredentialsOptions } from '../formats/indy/models/RequestedCredentials'
import type { RetrievedCredentials } from '../formats/indy/models/RetrievedCredentials'
import type { GetRequestedCredentialsConfig } from './GetRequestedCredentialsConfig'

export interface ProposeProofFormats {
  // If you want to propose an indy proof without attributes or
  // any of the other properties you should pass an empty object
  indy?: IndyProposeProofFormat
  presentationExchange?: never
}

export interface RequestProofFormats {
  indy?: IndyRequestProofFormat
  presentationExchange?: never
}

export interface CreatePresentationFormats {
  indy?: IndyRequestedCredentialsOptions
  presentationExchange?: never
}

export interface AcceptProposalFormats {
  indy?: IndyAcceptProposalOptions
  presentationExchange?: never
}

export interface VerifyProofFormats {
  indy?: IndyVerifyProofFormat
  presentationExchange?: never
}

export interface RequestedCredentialConfigOptions {
  indy?: GetRequestedCredentialsConfig
  presentationExchange?: never
}

// export interface RetrievedCredentialOptions {
//   indy?: RetrievedCredentials
//   presentationExchange?: undefined
// }

export interface ProofRequestFormats {
  indy?: ProofRequest
  presentationExchange?: undefined
}

// export interface RequestedCredentialsFormats {
//   indy?: RequestedCredentials
//   presentationExchange?: undefined
// }

interface IndyAcceptProposalOptions {
  request: ProofRequest
}

export interface AutoSelectCredentialOptions {
  indy?: RetrievedCredentials
  presentationExchange?: undefined
}
