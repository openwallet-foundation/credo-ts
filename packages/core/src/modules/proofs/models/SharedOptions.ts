import type { W3cCredential } from '../../vc/models'
import type {
  IndyProposeProofFormat,
  IndyRequestProofFormat,
  IndyVerifyProofFormat,
} from '../formats/IndyProofFormatsServiceOptions'
import type { PresentationExchangeProposalFormat } from '../formats/PresentationExchangeFormatsServiceOptions'
import type { ProofRequest } from '../formats/indy/models/ProofRequest'
import type { RequestedCredentials, IndyRequestedCredentialsOptions } from '../formats/indy/models/RequestedCredentials'
import type { RetrievedCredentials } from '../formats/indy/models/RetrievedCredentials'
import type {
  RequestPresentation,
  RequestPresentationOptions,
} from '../formats/presentation-exchange/models/RequestPresentation'
import type { GetRequestedCredentialsConfig } from './GetRequestedCredentialsConfig'

export interface ProposeProofFormats {
  // If you want to propose an indy proof without attributes or
  // any of the other properties you should pass an empty object
  indy?: IndyProposeProofFormat
  presentationExchange?: PresentationExchangeProposalFormat
}

export interface RequestProofFormats {
  // If you want to propose an indy proof without attributes or
  // any of the other properties you should pass an empty object
  indy?: IndyRequestProofFormat
  presentationExchange?: RequestPresentationOptions
}

export interface CreatePresentationFormats {
  // If you want to propose an indy proof without attributes or
  // any of the other properties you should pass an empty object
  indy?: IndyRequestedCredentialsOptions
  presentationExchange?: never
}

export interface AcceptProposalFormats {
  // If you want to propose an indy proof without attributes or
  // any of the other properties you should pass an empty object
  indy?: IndyAcceptProposalOptions
  presentationExchange?: never
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
  presentationExchange?: W3cCredential[] | undefined
}

export interface ProofRequestFormats {
  indy?: ProofRequest | undefined
  presentationExchange?: RequestPresentation | undefined
}

export interface RequestedCredentialsFormats {
  indy?: RequestedCredentials | undefined
  presentationExchange?: W3cCredential | undefined
}

interface IndyAcceptProposalOptions {
  request: ProofRequest
}

export interface AutoSelectCredentialOptions {
  indy?: RetrievedCredentials | undefined
  presentationExchange?: W3cCredential[] | undefined
}
