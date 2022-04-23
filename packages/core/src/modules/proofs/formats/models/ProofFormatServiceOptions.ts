import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { CreatePresentationFormats, ProposeProofFormats, RequestProofFormats } from '../../models/SharedOptions'
import type { PresentationPreview } from '../../protocol/v1/models/V1PresentationPreview'
import type { ProofRecord } from '../../repository'
import type { ProofRequestOptions } from '../indy/models/ProofRequest'
import type { InputDescriptorsSchemaOptions } from '../presentation-exchange/models'
import type { ProofAttachmentFormat } from './ProofAttachmentFormat'

export interface CreateRequestAttachmentOptions {
  attachId?: string
  proofRequestOptions: ProofRequestOptions
}

export interface CreateProofAttachmentOptions {
  attachId?: string
  proofProposalOptions: PresentationPreview
}

export interface CreatePresentationExchangeProposalAttachmentOptions {
  attachId?: string
  proofProposalOptions: InputDescriptorsSchemaOptions[]
}

export interface CreateProposalOptions {
  attachId?: string
  formats: ProposeProofFormats
}

export interface ProcessProposalOptions {
  record: ProofRecord
  proposal: ProofAttachmentFormat
}

export interface CreateRequestOptions {
  attachId?: string
  formats: ProposeProofFormats | RequestProofFormats
}

export interface ProcessRequestOptions {
  record: ProofRecord
  request: ProofAttachmentFormat
}

export interface CreatePresentationOptions {
  attachId?: string
  attachment: Attachment
  formats: CreatePresentationFormats
}

export interface ProcessPresentationOptions {
  record: ProofRecord
  presentation: {
    request: ProofAttachmentFormat[]
    proof: ProofAttachmentFormat[]
  }
}

export interface VerifyProofOptions {
  request: Attachment
  proof: Attachment
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CreateProblemReportOptions {
  proofRecord: ProofRecord
  description: string
} // TBD

export interface CreatePresentationFormatsOptions {
  presentationAttachment: Attachment
  config?: IndyProofConfig
}

interface IndyProofConfig {
  name: string
  version: string
  nonce?: string
}

export interface CreateRequestAsResponseOptions {
  attachId?: string
  formats: RequestProofFormats
}
