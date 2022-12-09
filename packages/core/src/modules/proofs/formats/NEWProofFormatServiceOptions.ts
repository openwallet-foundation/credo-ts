import type { Attachment } from '../../../decorators/attachment/Attachment'
import type { GetRequestedCredentialsConfig } from '../models/GetRequestedCredentialsConfig'
import type { ProposeProofFormats } from '../models/SharedOptions'
import type { PresentationPreview } from '../protocol/v1/models/V1PresentationPreview'
import type { ProofExchangeRecord } from '../repository/ProofExchangeRecord'
import type { ProofAttachmentFormat } from './ProofAttachmentFormat'
import type { ProofFormat, ProofFormatPayload } from './ProofFormat'
import type { ProofFormatService } from './ProofFormatService'
import type { ProofRequestOptions } from './indy'

/**
 * Get the service map for usage in the proofs module. Will return a type mapping of protocol version to service.
 *
 * @example
 * ```
 * type FormatServiceMap = ProofFormatServiceMap<[IndyProofFormat]>
 *
 * // equal to
 * type FormatServiceMap = {
 *   indy: ProofFormatServiceMap<IndyCredentialFormat>
 * }
 * ```
 */
export type ProofFormatServiceMap<PFs extends ProofFormat[]> = {
  [PF in PFs[number] as PF['formatKey']]: ProofFormatService<PF>
}

export interface FormatGetRequestedCredentials {
  attachment: Attachment
  presentationProposal?: PresentationPreview
  config?: GetRequestedCredentialsConfig
}

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

export interface FormatCreatePresentationOptions<PF extends ProofFormat> {
  id?: string
  attachment: Attachment
  proofFormats: ProofFormatPayload<[PF], 'createPresentation'>
}

export interface CreatePresentationFormatsOptions {
  presentationAttachment: Attachment
}
