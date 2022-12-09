import type { IndyProposeProofFormat } from '../formats/indy/IndyProofFormat'
import type { IndyRequestProofFormat, IndyVerifyProofFormat } from '../formats/indy/IndyProofFormatsServiceOptions'
import type { ProofRequest } from '../formats/indy/models/ProofRequest'
import type { IndyRequestedCredentialsOptions } from '../formats/indy/models/RequestedCredentials'
import type { RetrievedCredentials } from '../formats/indy/models/RetrievedCredentials'
import type {
  ProposePresentationExchangeOptions,
  RequestPresentationExchangeOptions,
} from '../formats/presentation-exchange/models/RequestPresentation'
import type { RequestPresentationOptions } from '../protocol/v1/messages'
import type { GetRequestedCredentialsConfig } from './GetRequestedCredentialsConfig'
import type { SelectResults } from '@sphereon/pex'
import type { IVerifiableCredential } from '@sphereon/ssi-types'

export interface ProposeProofFormats {
  indy?: IndyProposeProofFormat
  presentationExchange?: ProposePresentationExchangeOptions
}

export interface RequestProofFormats {
  indy?: IndyRequestProofFormat
  presentationExchange?: RequestPresentationOptions
}

export interface CreatePresentationFormats {
  indy?: IndyRequestedCredentialsOptions
  presentationExchange?: IVerifiableCredential
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

export interface RetrievedCredentialOptions {
  indy?: RetrievedCredentials
  presentationExchange?: SelectResults
}

export interface ProofRequestFormats {
  indy?: ProofRequest
  presentationExchange?: RequestPresentationExchangeOptions
}

interface IndyAcceptProposalOptions {
  request: ProofRequest
}

export interface AutoSelectCredentialOptions {
  indy?: RetrievedCredentials
  presentationExchange?: SelectResults
}
