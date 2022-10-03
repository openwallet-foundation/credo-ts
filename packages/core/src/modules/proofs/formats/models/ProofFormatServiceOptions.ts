import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { ProposeProofFormats } from '../../models/SharedOptions'
import type { ProofRecord } from '../../repository'
import type { ProofFormat, ProofFormatPayload } from '../ProofFormat'
import type { ProofRequestOptions } from '../indy/models/ProofRequest'
import type { ProofAttachmentFormat } from './ProofAttachmentFormat'

export interface FormatCreateRequestAttachmentOptions {
  id?: string
  proofRequestOptions: ProofRequestOptions
}

export interface FormatCreateProofAttachmentOptions {
  id?: string
  proofProposalOptions: ProofRequestOptions
}

// export interface FormatCreateProposalOptions {
//   id?: string
//   formats: ProposeProofFormats
// }

export interface FormatCreateProposalOptions<PF extends ProofFormat> {
  id?: string
  proofFormats: ProofFormatPayload<[PF], 'createProposal'>
}

export interface FormatProcessProposalOptions {
  proposal: ProofAttachmentFormat
  record?: ProofRecord
}

export interface FormatCreateRequestOptions {
  id?: string
  formats: ProposeProofFormats
}

export interface FormatProcessRequestOptions<PF extends ProofFormat> {
  proofFormats: ProofFormatPayload<[PF], 'acceptRequest'>
}

export interface FormatCreatePresentationOptions<PF extends ProofFormat> {
  id?: string
  attachment: Attachment
  proofFormats: ProofFormatPayload<[PF], 'createPresentation'>
}

export interface FormatProcessPresentationOptions {
  record: ProofRecord
  formatAttachments: {
    request: ProofAttachmentFormat[]
    presentation: ProofAttachmentFormat[]
  }
}

export interface FormatVerifyProofOptions {
  request: Attachment
  proof: Attachment
}

export interface FormatCreateProblemReportOptions {
  proofRecord: ProofRecord
  description: string
}

export interface FormatCreatePresentationFormatsOptions {
  presentationAttachment: Attachment
}
