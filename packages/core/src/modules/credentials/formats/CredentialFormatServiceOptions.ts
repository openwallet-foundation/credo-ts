import type { Attachment } from '../../../decorators/attachment/Attachment'
import type { CredentialFormatSpec } from '../models/CredentialFormatSpec'
import type { CredentialPreviewAttribute } from '../models/CredentialPreviewAttribute'
import type { CredentialExchangeRecord } from '../repository/CredentialExchangeRecord'
import type { CredentialFormat, CredentialFormatPayload } from './CredentialFormat'
import type { CredentialFormatService } from './CredentialFormatService'

/**
 * Get the service map for usage in the credentials module. Will return a type mapping of protocol version to service.
 *
 * @example
 * ```
 * type CredentialFormatServiceMap = FormatServiceMap<[IndyCredentialFormat]>
 *
 * // equal to
 * type CredentialFormatServiceMap = {
 *   indy: CredentialFormatService<IndyCredentialFormat>
 * }
 * ```
 */
export type FormatServiceMap<CFs extends CredentialFormat[]> = {
  [CF in CFs[number] as CF['formatKey']]: CredentialFormatService<CF>
}

/**
 * Base return type for all methods that create an attachment format.
 *
 * It requires an attachment and a format to be returned.
 */
export interface FormatCreateReturn {
  format: CredentialFormatSpec
  attachment: Attachment
}

/**
 * Base return type for all process methods.
 */
export interface FormatProcessOptions {
  attachment: Attachment
  credentialRecord: CredentialExchangeRecord
}

export interface FormatCreateProposalOptions<CF extends CredentialFormat> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats: CredentialFormatPayload<[CF], 'createProposal'>
}

export interface FormatAcceptProposalOptions<CF extends CredentialFormat> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats?: CredentialFormatPayload<[CF], 'acceptProposal'>
  attachId?: string

  proposalAttachment: Attachment
}

export interface FormatCreateProposalReturn extends FormatCreateReturn {
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

  offerAttachment: Attachment
}

export interface FormatCreateOfferReturn extends FormatCreateReturn {
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

  requestAttachment: Attachment
  offerAttachment?: Attachment
}

// Auto accept method interfaces
export interface FormatAutoRespondProposalOptions {
  credentialRecord: CredentialExchangeRecord
  proposalAttachment: Attachment
  offerAttachment: Attachment
}

export interface FormatAutoRespondOfferOptions {
  credentialRecord: CredentialExchangeRecord
  proposalAttachment: Attachment
  offerAttachment: Attachment
}

export interface FormatAutoRespondRequestOptions {
  credentialRecord: CredentialExchangeRecord
  proposalAttachment?: Attachment
  offerAttachment: Attachment
  requestAttachment: Attachment
}

export interface FormatAutoRespondCredentialOptions {
  credentialRecord: CredentialExchangeRecord
  proposalAttachment?: Attachment
  offerAttachment?: Attachment
  requestAttachment: Attachment
  credentialAttachment: Attachment
}
