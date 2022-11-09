import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { ProposeProofFormats } from '../../models/SharedOptions'
import type { ProofExchangeRecord } from '../../repository'
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

export interface FormatCreateProofProposalOptions {
  id?: string
  formats: ProposeProofFormats
}

export interface ProcessProposalOptions {
  proposal: ProofAttachmentFormat
  record?: ProofExchangeRecord
}

export interface CreateRequestOptions {
  id?: string
  formats: ProposeProofFormats
}

export interface ProcessRequestOptions {
  requestAttachment: ProofAttachmentFormat
  record?: ProofExchangeRecord
}

export interface FormatCreatePresentationOptions<PF extends ProofFormat> {
  id?: string
  attachment: Attachment
  proofFormats: ProofFormatPayload<[PF], 'createPresentation'>
}

export interface ProcessPresentationOptions {
  record: ProofExchangeRecord
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
  proofRecord: ProofExchangeRecord
  description: string
}

export interface CreatePresentationFormatsOptions {
  presentationAttachment: Attachment
}
