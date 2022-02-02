import type { ProofRecord, ProofRequestOptions } from '../..'
import type { AttachmentData } from '../../../../decorators/attachment/Attachment'
import type { ProposeProofFormats } from '../../models/SharedOptions'
import type { ProofAttachmentFormat } from './ProofAttachmentFormat'

export interface CreateRequestAttachmentOptions {
  attachId?: string
  messageType: string
  proofRequestOptions: ProofRequestOptions
}

export interface CreateProposalOptions {
  attachId?: string
  messageType: string
  formats: ProposeProofFormats
}

export interface ProcessProposalOptions {
  record: ProofRecord
  proposal: ProofAttachmentFormat
  options: never // TBD
}

export interface CreateRequestOptions {
  attachId?: string
  messageType: string
  formats: ProposeProofFormats
}

export interface ProcessRequestOptions {
  record: ProofRecord
  request: ProofAttachmentFormat
  options: never // TBD
}

export interface CreatePresentationOptions {
  attachId?: string
  messageType: string
  attachData: AttachmentData
}

export interface ProcessPresentationOptions {
  record: ProofRecord
  presentation: ProofAttachmentFormat
  options: never // TBD
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CreateProblemReportOptions {} // TBD
