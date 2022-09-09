import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { ProposeProofFormats } from '../../models/SharedOptions'
import type { ProofRecord } from '../../repository'
import type { ProofFormat, ProofFormatPayload } from '../ProofFormat'
import type { ProofRequestOptions } from '../indy/models/ProofRequest'
import type { ProofAttachmentFormat } from './ProofAttachmentFormat'

export interface CreateRequestAttachmentOptions {
  id?: string
  proofRequestOptions: ProofRequestOptions
}

export interface CreateProofAttachmentOptions {
  id?: string
  proofProposalOptions: ProofRequestOptions
}

export interface FormatCreateProposalOptions {
  id?: string
  formats: ProposeProofFormats
}

export interface ProcessProposalOptions {
  proposal: ProofAttachmentFormat
  record?: ProofRecord
}

export interface CreateRequestOptions {
  id?: string
  formats: ProposeProofFormats
}

export interface ProcessRequestOptions {
  requestAttachment: ProofAttachmentFormat
  record?: ProofRecord
}

export interface FormatCreatePresentationOptions<PF extends ProofFormat> {
  id?: string
  attachment: Attachment
  proofFormats: ProofFormatPayload<[PF], 'createPresentation'>
}

export interface ProcessPresentationOptions {
  record: ProofRecord
  formatAttachments: {
    request: ProofAttachmentFormat[]
    presentation: ProofAttachmentFormat[]
  }
}

export interface VerifyProofOptions {
  request: Attachment
  proof: Attachment
}

export interface CreateProblemReportOptions {
  proofRecord: ProofRecord
  description: string
}

export interface CreatePresentationFormatsOptions {
  presentationAttachment: Attachment
}
