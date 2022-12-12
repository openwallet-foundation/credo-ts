import type { ProofExchangeRecord } from '../../repository'
import type { ProofAttachmentFormat } from '../ProofAttachmentFormat'
import type { ProofFormat } from '../ProofFormat'
import type { RequestProofFormats } from '../ProofFormatServiceOptions'
import type { SelectResults } from '@sphereon/pex'
import type { PresentationDefinitionV1 } from '@sphereon/pex-models'
import type { IVerifiableCredential } from '@sphereon/ssi-types'

export const V2_PRESENTATION_EXCHANGE_PRESENTATION_PROPOSAL = 'dif/presentation-exchange/definitions@v1.0'
export const V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST = 'dif/presentation-exchange/definitions@v1.0'
export const V2_PRESENTATION_EXCHANGE_PRESENTATION = 'dif/presentation-exchange/submission@v1.0'

export interface PresentationExchangeCreateProposalFormat {
  presentationDefinition: PresentationDefinitionV1
}

export interface PresentationExchangeCreateOutOfBandRequestFormat {
  options: {
    challenge: string
    domain: string
  }
  presentationDefinition: PresentationDefinitionV1
}

export interface PresentationExchangeCreateRequestAsResponseFormat {
  attachId?: string
  formats: RequestProofFormats
}

export interface PresentationExchangeAcceptRequestFormat {
  record?: ProofExchangeRecord
  formatAttachments: {
    request: ProofAttachmentFormat
  }
}

export interface PresentationExchangeCreatePresentationFormat {
  formats: IVerifiableCredential
}

export interface PresentationExchangeSelectResultsFormat {
  formats: SelectResults
}

export interface PresentationExchangeProofFormat extends ProofFormat {
  formatKey: 'presentationExchange'
  proofRecordType: 'presentationExchange'
  proofFormats: {
    createProposal: PresentationExchangeCreateProposalFormat
    acceptProposal: unknown
    createRequest: unknown
    acceptRequest: PresentationExchangeAcceptRequestFormat
    createPresentation: PresentationExchangeCreatePresentationFormat
    acceptPresentation: unknown
    createProposalAsResponse: PresentationExchangeCreateProposalFormat
    createOutOfBandRequest: PresentationExchangeCreateOutOfBandRequestFormat
    createRequestAsResponse: PresentationExchangeCreateRequestAsResponseFormat
    createProofRequestFromProposal: unknown
    requestCredentials: PresentationExchangeCreatePresentationFormat
    retrieveCredentials: PresentationExchangeSelectResultsFormat
  }
}
