import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { CreatePresentationFormats, ProposeProofFormats, RequestProofFormats } from '../../models/SharedOptions'
import type { PresentationPreview } from '../../protocol/v1/models/V1PresentationPreview'
import type { ProofRecord } from '../../repository'
import type { ProofRequestOptions } from '../indy/models/ProofRequest'
import type { InputDescriptorsSchemaOptions } from '../presentation-exchange/models'
import type { ProofAttachmentFormat } from './ProofAttachmentFormat'

export interface CreateRequestAttachmentOptions {
  id?: string
  proofRequestOptions: ProofRequestOptions
}

export interface CreateProofAttachmentOptions {
  id?: string
  proofProposalOptions: PresentationPreview
}

export interface CreatePresentationExchangeProposalAttachmentOptions {
  attachId?: string
  proofProposalOptions: InputDescriptorsSchemaOptions[]
}

export interface CreateProposalOptions {
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
  record: ProofRecord
  request: ProofAttachmentFormat
}

export interface CreatePresentationOptions {
  id?: string
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

export interface CreateProblemReportOptions {
  proofRecord: ProofRecord
  description: string
}

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
