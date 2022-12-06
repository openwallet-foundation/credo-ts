import type { LinkedAttachment } from '../../../../utils/LinkedAttachment'
import type { CredentialPreviewAttributeOptions } from '../../../credentials'
import type { RequestProofFormats } from '../../models/SharedOptions'
import type {
  PresentationPreviewAttribute,
  PresentationPreviewPredicate,
} from '../../protocol/v1/models/V1PresentationPreview'
import type { ProofExchangeRecord } from '../../repository'
import type { ProofFormat } from '../ProofFormat'
import type { ProofAttachmentFormat } from '../models/ProofAttachmentFormat'
import type { SelectResults } from '@sphereon/pex'
import type { PresentationDefinitionV1 } from '@sphereon/pex-models'
import type { IVerifiableCredential } from '@sphereon/ssi-types'

export const V2_PRESENTATION_EXCHANGE_PRESENTATION_PROPOSAL = 'dif/presentation-exchange/definitions@v1.0'
export const V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST = 'dif/presentation-exchange/definitions@v1.0'
export const V2_PRESENTATION_EXCHANGE_PRESENTATION = 'dif/presentation-exchange/submission@v1.0'

export interface IndyProposeProofFormat {
  attributes?: PresentationPreviewAttribute[]
  predicates?: PresentationPreviewPredicate[]
  nonce: string
  name: string
  version: string
}

/**
 * This defines the module payload for calling CredentialsApi.acceptProposal
 */
export interface IndyAcceptProposalFormat {
  credentialDefinitionId?: string
  attributes?: CredentialPreviewAttributeOptions[]
  linkedAttachments?: LinkedAttachment[]
}

export interface IndyAcceptOfferFormat {
  holderDid?: string
}

export interface PresentationExchangeProposalFormat {
  presentationDefinition: PresentationDefinitionV1
}

export interface PresentationExchangeOutOfBandRequestFormat {
  options: {
    challenge: string
    domain: string
  }
  presentationDefinition: PresentationDefinitionV1
}

export interface PresentationExchangeRequestAsResponseFormat {
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
    createProposal: PresentationExchangeProposalFormat
    acceptProposal: unknown
    createRequest: unknown
    acceptRequest: PresentationExchangeAcceptRequestFormat
    createPresentation: PresentationExchangeCreatePresentationFormat
    acceptPresentation: unknown
    createProposalAsResponse: PresentationExchangeProposalFormat
    createOutOfBandRequest: PresentationExchangeOutOfBandRequestFormat
    createRequestAsResponse: PresentationExchangeRequestAsResponseFormat
    createProofRequestFromProposal: unknown
    requestCredentials: PresentationExchangeCreatePresentationFormat
    retrieveCredentials: PresentationExchangeSelectResultsFormat
  }
}
