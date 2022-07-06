import type { Attachment } from '../../../decorators/attachment/Attachment'
import type { ProofRecord } from '../repository'
import type { ProofFormat, ProofFormatPayload } from './ProofFormat'
import type { ProofFormatService } from './ProofFormatService'

/**
 * Get the service map for usage in the proofs module. Will return a type mapping of protocol version to service.
 *
 * @example
 * ```
 * type ProofFormatServiceMap = FormatServiceMap<[IndyProofFormat]>
 *
 * // equal to
 * type ProofFormatServiceMap = {
 *   indy: ProofFormatService<IndyProofFormat>
 * }
 * ```
 */
export type FormatServiceMap<PFs extends ProofFormat[]> = {
  [PF in PFs[number] as PF['formatKey']]: ProofFormatService<PF>
}

/**
 * Base return type for all methods that create an attachment format.
 *
 * It requires an attachment and a format to be returned.
 */
export interface FormatCreateReturn {
  format: ProofFormatService
  attachment: Attachment
}

/**
 * Base return type for all process methods.
 */
export interface FormatProcessOptions {
  attachment: Attachment
  proofRecord: ProofRecord
}

export interface FormatCreateProposalOptions<PF extends ProofFormat> {
  proofRecord: ProofRecord
  proofFormats: ProofFormatPayload<[PF], 'createProposal'>
}

export interface FormatAcceptProposalOptions<PF extends ProofFormat> {
  proofRecord: ProofRecord
  proofFormats?: ProofFormatPayload<[PF], 'acceptProposal'>
  attachId?: string

  proposalAttachment: Attachment
}

export interface FormatCreateRequestOptions<PF extends ProofFormat> {
  proofRecord: ProofRecord
  proofFormats: ProofFormatPayload<[PF], 'createRequest'>
}

export interface FormatAcceptRequestOptions<PF extends ProofFormat> {
  proofRecord: ProofRecord
  proofFormats?: ProofFormatPayload<[PF], 'acceptRequest'>
  attachId?: string

  requestAttachment: Attachment
  proposalAttachment?: Attachment
}

// Auto accept method interfaces
export interface FormatAutoRespondProposalOptions {
  proofRecord: ProofRecord
  proposalAttachment: Attachment
  requestAttachment: Attachment
}

export interface FormatAutoRespondRequestOptions {
  proofRecord: ProofRecord
  proposalAttachment: Attachment
  requestAttachment: Attachment
}

export interface FormatAutoRespondPresentationOptions {
  proofRecord: ProofRecord
  proposalAttachment?: Attachment
  requestAttachment: Attachment
  credentialAttachment: Attachment
}
