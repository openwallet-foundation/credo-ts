import type {
  ProofRecord,
  ProofRequest,
  ProofRequestOptions,
  V1PresentationMessage,
  V1RequestPresentationMessage,
} from '../..'
import type { RequestedCredentials } from '../../../..'
import type { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import type { CreatePresentationFormats, ProposeProofFormats, VerifyProofFormats } from '../../models/SharedOptions'
import type { ProofAttachmentFormat } from './ProofAttachmentFormat'
import type { IndyProof } from 'indy-sdk'

export interface CreateRequestAttachmentOptions {
  attachId?: string
  proofRequestOptions: ProofRequestOptions
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
  problemCode: string
  description: string
} // TBD
