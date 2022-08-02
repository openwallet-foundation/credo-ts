import type { Attachment } from '../../../decorators/attachment/Attachment'
import type { ProofFormat } from './ProofFormat'
import type { ProofFormatService } from './ProofFormatService'
import type { ProofFormatSpec } from './models/ProofFormatSpec'

/**
 * Get the service map for usage in the proofs module. Will return a type mapping of protocol version to service.
 *
 * @example
 * ```
 * type ProofFormatServiceMap = FormatServiceMap<[IndyProofFormat]>
 *
 * // equal to
 * type ProofFormatServiceMap = {
 *   indy: ProofFormatService<IndyCredentialFormat>
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
  format: ProofFormatSpec
  attachment: Attachment
}

// /**
//  * Base return type for all process methods.
//  */
// export interface FormatProcessOptions {
//   attachment: Attachment
//   cRecord: CredentialExchangeRecord
// }

export interface FormatCreatePresentationOptions<PF extends ProofFormat> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats: CredentialFormatPayload<[PF], 'createOffer'>
  attachId?: string
}

// export interface FormatCreateProposalOptions<CF extends CredentialFormat> {
//   credentialRecord: CredentialExchangeRecord
//   credentialFormats: CredentialFormatPayload<[CF], 'createProposal'>
// }

// export interface FormatAcceptProposalOptions<CF extends CredentialFormat> {
//   credentialRecord: CredentialExchangeRecord
//   credentialFormats?: CredentialFormatPayload<[CF], 'acceptProposal'>
//   attachId?: string

//   proposalAttachment: Attachment
// }

// export interface FormatCreateProposalReturn extends FormatCreateReturn {
//   previewAttributes?: CredentialPreviewAttribute[]
// }

// export interface FormatCreateOfferOptions<CF extends CredentialFormat> {
//   credentialRecord: CredentialExchangeRecord
//   credentialFormats: CredentialFormatPayload<[CF], 'createOffer'>
//   attachId?: string
// }

// export interface FormatAcceptOfferOptions<CF extends CredentialFormat> {
//   credentialRecord: CredentialExchangeRecord
//   credentialFormats?: CredentialFormatPayload<[CF], 'acceptOffer'>
//   attachId?: string

//   offerAttachment: Attachment
// }

// export interface FormatCreateOfferReturn extends FormatCreateReturn {
//   previewAttributes?: CredentialPreviewAttribute[]
// }

// export interface FormatCreateRequestOptions<CF extends CredentialFormat> {
//   credentialRecord: CredentialExchangeRecord
//   credentialFormats: CredentialFormatPayload<[CF], 'createRequest'>
// }

// export interface FormatAcceptRequestOptions<CF extends CredentialFormat> {
//   credentialRecord: CredentialExchangeRecord
//   credentialFormats?: CredentialFormatPayload<[CF], 'acceptRequest'>
//   attachId?: string

//   requestAttachment: Attachment
//   offerAttachment?: Attachment
// }

// // Auto accept method interfaces
// export interface FormatAutoRespondProposalOptions {
//   credentialRecord: CredentialExchangeRecord
//   proposalAttachment: Attachment
//   offerAttachment: Attachment
// }

// export interface FormatAutoRespondOfferOptions {
//   credentialRecord: CredentialExchangeRecord
//   proposalAttachment: Attachment
//   offerAttachment: Attachment
// }

// export interface FormatAutoRespondRequestOptions {
//   credentialRecord: CredentialExchangeRecord
//   proposalAttachment?: Attachment
//   offerAttachment: Attachment
//   requestAttachment: Attachment
// }

// export interface FormatAutoRespondCredentialOptions {
//   credentialRecord: CredentialExchangeRecord
//   proposalAttachment?: Attachment
//   offerAttachment?: Attachment
//   requestAttachment: Attachment
//   credentialAttachment: Attachment
// }
