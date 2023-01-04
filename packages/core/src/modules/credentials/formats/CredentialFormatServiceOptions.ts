import type { V1Attachment } from '../../../decorators/attachment/V1Attachment'
import type { CredentialFormatSpec } from '../models/CredentialFormatSpec'
import type { CredentialPreviewAttribute } from '../models/CredentialPreviewAttribute'
import type { CredentialExchangeRecord } from '../repository/CredentialExchangeRecord'
import type { CredentialFormat, CredentialFormatPayload } from './CredentialFormat'
import type { CredentialFormatService } from './CredentialFormatService'

/**
 * Infer the {@link CredentialFormat} based on a {@link CredentialFormatService}.
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
export type ExtractCredentialFormat<Type> = Type extends CredentialFormatService<infer CredentialFormat>
  ? CredentialFormat
  : never

/**
 * Infer an array of {@link CredentialFormat} types based on an array of {@link CredentialFormatService} types.
 *
 * This is based on {@link ExtractCredentialFormat}, but allows to handle arrays.
 */
export type ExtractCredentialFormats<CFs extends CredentialFormatService[]> = {
  [CF in keyof CFs]: ExtractCredentialFormat<CFs[CF]>
}

/**
 * Base return type for all methods that create an attachment format.
 *
 * It requires an attachment and a format to be returned.
 */
export interface CredentialFormatCreateReturn {
  format: CredentialFormatSpec
  attachment: V1Attachment
}

/**
 * Base return type for all process methods.
 */
export interface FormatProcessOptions {
  attachment: V1Attachment
  credentialRecord: CredentialExchangeRecord
}

export interface FormatProcessCredentialOptions extends FormatProcessOptions {
  requestAttachment: V1Attachment
}

export interface FormatCreateProposalOptions<CF extends CredentialFormat> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats: CredentialFormatPayload<[CF], 'createProposal'>
}

export interface FormatAcceptProposalOptions<CF extends CredentialFormat> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats?: CredentialFormatPayload<[CF], 'acceptProposal'>
  attachId?: string

  proposalAttachment: V1Attachment
}

export interface FormatCreateProposalReturn extends CredentialFormatCreateReturn {
  previewAttributes?: CredentialPreviewAttribute[]
}

export interface FormatCreateOfferOptions<CF extends CredentialFormat> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats: CredentialFormatPayload<[CF], 'createOffer'>
  attachId?: string
}

export interface FormatAcceptOfferOptions<CF extends CredentialFormat> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats?: CredentialFormatPayload<[CF], 'acceptOffer'>
  attachId?: string

  offerAttachment: V1Attachment
}

export interface FormatCreateOfferReturn extends CredentialFormatCreateReturn {
  previewAttributes?: CredentialPreviewAttribute[]
}

export interface FormatCreateRequestOptions<CF extends CredentialFormat> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats: CredentialFormatPayload<[CF], 'createRequest'>
}

export interface FormatAcceptRequestOptions<CF extends CredentialFormat> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats?: CredentialFormatPayload<[CF], 'acceptRequest'>
  attachId?: string

  requestAttachment: V1Attachment
  offerAttachment?: V1Attachment
}

export interface FormatAcceptCredentialOptions {
  credentialRecord: CredentialExchangeRecord
  attachId?: string
  requestAttachment: V1Attachment
  offerAttachment?: V1Attachment
}
// Auto accept method interfaces
export interface FormatAutoRespondProposalOptions {
  credentialRecord: CredentialExchangeRecord
  proposalAttachment: V1Attachment
  offerAttachment: V1Attachment
}

export interface FormatAutoRespondOfferOptions {
  credentialRecord: CredentialExchangeRecord
  proposalAttachment: V1Attachment
  offerAttachment: V1Attachment
}

export interface FormatAutoRespondRequestOptions {
  credentialRecord: CredentialExchangeRecord
  proposalAttachment?: V1Attachment
  offerAttachment: V1Attachment
  requestAttachment: V1Attachment
}

export interface FormatAutoRespondCredentialOptions {
  credentialRecord: CredentialExchangeRecord
  proposalAttachment?: V1Attachment
  offerAttachment?: V1Attachment
  requestAttachment: V1Attachment
  credentialAttachment: V1Attachment
}
