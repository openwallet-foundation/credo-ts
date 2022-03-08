import type { ProofRecord, ProofRequestOptions } from '../..'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { CreatePresentationFormats, ProposeProofFormats } from '../../models/SharedOptions'
import type { PresentationPreview } from '../../protocol/v1/models/PresentationPreview'
import type { ProofAttachmentFormat } from './ProofAttachmentFormat'

export interface CreateRequestAttachmentOptions {
  attachId?: string
  proofRequestOptions: ProofRequestOptions
}

export interface CreateProofAttachmentOptions {
  attachId?: string
  proofProposalOptions: PresentationPreview
}

export interface CreateProposalOptions {
  attachId?: string
  formats: ProposeProofFormats
}

export interface ProcessProposalOptions {
  record: ProofRecord
  proposal: ProofAttachmentFormat
  options: never // TBD
}

export interface CreateRequestOptions {
  attachId?: string
  formats: ProposeProofFormats
}

export interface ProcessRequestOptions {
  record: ProofRecord
  request: ProofAttachmentFormat
  options: never // TBD
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
  options?: never // TBD
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
