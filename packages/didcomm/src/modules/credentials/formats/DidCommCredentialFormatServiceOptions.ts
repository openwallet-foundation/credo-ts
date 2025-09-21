import type { DidCommAttachment } from '../../../decorators/attachment/DidCommAttachment'
import type { DidCommCredentialFormatSpec } from '../models/DidCommCredentialFormatSpec'
import type { DidCommCredentialPreviewAttributeOptions } from '../models/DidCommCredentialPreviewAttribute'
import type { DidCommCredentialExchangeRecord } from '../repository/DidCommCredentialExchangeRecord'
import type { DidCommCredentialFormat, DidCommCredentialFormatPayload } from './DidCommCredentialFormat'
import type { DidCommCredentialFormatService } from './DidCommCredentialFormatService'

/**
 * Infer the {@link DidCommCredentialFormat} based on a {@link DidCommCredentialFormatService}.
 *
 * It does this by extracting the `CredentialFormat` generic from the `CredentialFormatService`.
 *
 * @example
 * ```
 * // TheCredentialFormat is now equal to IndyCredentialFormat
 * type TheCredentialFormat = ExtractCredentialFormat<IndyCredentialFormatService>
 * ```
 *
 * Because the `IndyCredentialFormatService` is defined as follows:
 * ```
 * class IndyCredentialFormatService implements CredentialFormatService<IndyCredentialFormat> {
 * }
 * ```
 */
export type ExtractCredentialFormat<Type> = Type extends DidCommCredentialFormatService<infer CredentialFormat>
  ? CredentialFormat
  : never

/**
 * Infer an array of {@link DidCommCredentialFormat} types based on an array of {@link DidCommCredentialFormatService} types.
 *
 * This is based on {@link ExtractCredentialFormat}, but allows to handle arrays.
 */
export type ExtractCredentialFormats<CFs extends DidCommCredentialFormatService[]> = {
  [CF in keyof CFs]: ExtractCredentialFormat<CFs[CF]>
}

/**
 * Base return type for all methods that create an attachment format.
 *
 * It requires an attachment and a format to be returned.
 */
export interface CredentialFormatCreateReturn {
  format: DidCommCredentialFormatSpec
  attachment: DidCommAttachment
  appendAttachments?: DidCommAttachment[]
}

/**
 * Base return type for all credential process methods.
 */
export interface CredentialFormatProcessOptions {
  attachment: DidCommAttachment
  credentialExchangeRecord: DidCommCredentialExchangeRecord
}

export interface CredentialFormatProcessCredentialOptions extends CredentialFormatProcessOptions {
  offerAttachment: DidCommAttachment
  requestAttachment: DidCommAttachment
  requestAppendAttachments?: DidCommAttachment[]
}

export interface CredentialFormatCreateProposalOptions<CF extends DidCommCredentialFormat> {
  credentialExchangeRecord: DidCommCredentialExchangeRecord
  credentialFormats: DidCommCredentialFormatPayload<[CF], 'createProposal'>
  attachmentId?: string
}

export interface CredentialFormatAcceptProposalOptions<CF extends DidCommCredentialFormat> {
  credentialExchangeRecord: DidCommCredentialExchangeRecord
  credentialFormats?: DidCommCredentialFormatPayload<[CF], 'acceptProposal'>
  attachmentId?: string

  proposalAttachment: DidCommAttachment
}

export interface CredentialFormatCreateProposalReturn extends CredentialFormatCreateReturn {
  previewAttributes?: DidCommCredentialPreviewAttributeOptions[]
}

export interface CredentialFormatCreateOfferOptions<CF extends DidCommCredentialFormat> {
  credentialExchangeRecord: DidCommCredentialExchangeRecord
  credentialFormats: DidCommCredentialFormatPayload<[CF], 'createOffer'>
  attachmentId?: string
}

export interface CredentialFormatAcceptOfferOptions<CF extends DidCommCredentialFormat> {
  credentialExchangeRecord: DidCommCredentialExchangeRecord
  credentialFormats?: DidCommCredentialFormatPayload<[CF], 'acceptOffer'>
  attachmentId?: string
  offerAttachment: DidCommAttachment
}

export interface CredentialFormatCreateOfferReturn extends CredentialFormatCreateReturn {
  previewAttributes?: DidCommCredentialPreviewAttributeOptions[]
}

export interface CredentialFormatCreateRequestOptions<CF extends DidCommCredentialFormat> {
  credentialExchangeRecord: DidCommCredentialExchangeRecord
  credentialFormats: DidCommCredentialFormatPayload<[CF], 'createRequest'>
}

export interface CredentialFormatAcceptRequestOptions<CF extends DidCommCredentialFormat> {
  credentialExchangeRecord: DidCommCredentialExchangeRecord
  credentialFormats?: DidCommCredentialFormatPayload<[CF], 'acceptRequest'>
  attachmentId?: string
  offerAttachment?: DidCommAttachment
  requestAttachment: DidCommAttachment
  requestAppendAttachments?: DidCommAttachment[]
}

// Auto accept method interfaces
export interface CredentialFormatAutoRespondProposalOptions {
  credentialExchangeRecord: DidCommCredentialExchangeRecord
  proposalAttachment: DidCommAttachment
  offerAttachment: DidCommAttachment
}

export interface CredentialFormatAutoRespondOfferOptions {
  credentialExchangeRecord: DidCommCredentialExchangeRecord
  proposalAttachment: DidCommAttachment
  offerAttachment: DidCommAttachment
}

export interface CredentialFormatAutoRespondRequestOptions {
  credentialExchangeRecord: DidCommCredentialExchangeRecord
  proposalAttachment?: DidCommAttachment
  offerAttachment: DidCommAttachment
  requestAttachment: DidCommAttachment
}

export interface CredentialFormatAutoRespondCredentialOptions {
  credentialExchangeRecord: DidCommCredentialExchangeRecord
  proposalAttachment?: DidCommAttachment
  offerAttachment?: DidCommAttachment
  requestAttachment: DidCommAttachment
  credentialAttachment: DidCommAttachment
}
