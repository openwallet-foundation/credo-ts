import type { IndyProposeProofFormat } from '../formats/indy/IndyProofFormat'
import type { IndyRequestProofFormat } from '../formats/indy/IndyProofFormatsServiceOptions'
import type { ProofRequest } from '../formats/indy/models/ProofRequest'
import type {
  ProposePresentationExchangeOptions,
  RequestPresentationExchangeOptions,
} from '../formats/presentation-exchange/models/RequestPresentation'
import type { RequestPresentationOptions } from '../protocol/v1/messages'

export interface ProposeProofFormats {
  indy?: IndyProposeProofFormat
  presentationExchange?: ProposePresentationExchangeOptions
}

export interface RequestProofFormats {
  indy?: IndyRequestProofFormat
  presentationExchange?: RequestPresentationOptions
}

export interface ProofRequestFormats {
  indy?: ProofRequest
  presentationExchange?: RequestPresentationExchangeOptions
}
