import type { DidCommAttachment } from '../../../decorators/attachment/DidCommAttachment'
import type { DidCommProofFormatSpec } from '../models/DidCommProofFormatSpec'
import type { DidCommProofExchangeRecord } from '../repository/DidCommProofExchangeRecord'
import type {
  DidCommProofFormat,
  DidCommProofFormatCredentialForRequestPayload,
  DidCommProofFormatPayload,
} from './DidCommProofFormat'
import type { DidCommProofFormatService } from './DidCommProofFormatService'

/**
 * Infer the {@link DidCommProofFormat} based on a {@link DidCommProofFormatService}.
 *
 * It does this by extracting the `ProofFormat` generic from the `ProofFormatService`.
 *
 * @example
 * ```
 * // TheProofFormat is now equal to IndyProofFormat
 * type TheProofFormat = ExtractProofFormat<IndyProofFormatService>
 * ```
 *
 * Because the `IndyProofFormatService` is defined as follows:
 * ```
 * class IndyProofFormatService implements ProofFormatService<IndyProofFormat> {
 * }
 * ```
 */
export type ExtractProofFormat<Type> = Type extends DidCommProofFormatService<infer ProofFormat> ? ProofFormat : never

/**
 * Infer an array of {@link DidCommProofFormat} types based on an array of {@link DidCommProofFormatService} types.
 *
 * This is based on {@link ExtractProofFormat}, but allows to handle arrays.
 */
export type ExtractProofFormats<PFs extends DidCommProofFormatService[]> = {
  [PF in keyof PFs]: ExtractProofFormat<PFs[PF]>
}

/**
 * Base return type for all methods that create an attachment format.
 *
 * It requires an attachment and a format to be returned.
 */
export interface ProofFormatCreateReturn {
  format: DidCommProofFormatSpec
  attachment: DidCommAttachment
}

/**
 * Base type for all proof process methods.
 */
export interface ProofFormatProcessOptions {
  attachment: DidCommAttachment
  proofRecord: DidCommProofExchangeRecord
}

export interface ProofFormatProcessPresentationOptions extends ProofFormatProcessOptions {
  requestAttachment: DidCommAttachment
}

export interface ProofFormatCreateProposalOptions<PF extends DidCommProofFormat> {
  proofRecord: DidCommProofExchangeRecord
  proofFormats: DidCommProofFormatPayload<[PF], 'createProposal'>
  attachmentId?: string
}

export interface ProofFormatAcceptProposalOptions<PF extends DidCommProofFormat> {
  proofRecord: DidCommProofExchangeRecord
  proofFormats?: DidCommProofFormatPayload<[PF], 'acceptProposal'>
  attachmentId?: string

  proposalAttachment: DidCommAttachment
}

export interface FormatCreateRequestOptions<PF extends DidCommProofFormat> {
  proofRecord: DidCommProofExchangeRecord
  proofFormats: DidCommProofFormatPayload<[PF], 'createRequest'>
  attachmentId?: string
}

export interface ProofFormatAcceptRequestOptions<PF extends DidCommProofFormat> {
  proofRecord: DidCommProofExchangeRecord
  proofFormats?: DidCommProofFormatPayload<[PF], 'acceptRequest'>
  attachmentId?: string

  requestAttachment: DidCommAttachment
  proposalAttachment?: DidCommAttachment
}

export interface ProofFormatGetCredentialsForRequestOptions<PF extends DidCommProofFormat> {
  proofRecord: DidCommProofExchangeRecord
  proofFormats?: DidCommProofFormatCredentialForRequestPayload<[PF], 'getCredentialsForRequest', 'input'>

  requestAttachment: DidCommAttachment
  proposalAttachment?: DidCommAttachment
}

export type ProofFormatGetCredentialsForRequestReturn<PF extends DidCommProofFormat> =
  PF['proofFormats']['getCredentialsForRequest']['output']

export interface ProofFormatSelectCredentialsForRequestOptions<PF extends DidCommProofFormat> {
  proofRecord: DidCommProofExchangeRecord
  proofFormats?: DidCommProofFormatCredentialForRequestPayload<[PF], 'selectCredentialsForRequest', 'input'>

  requestAttachment: DidCommAttachment
  proposalAttachment?: DidCommAttachment
}

export type ProofFormatSelectCredentialsForRequestReturn<PF extends DidCommProofFormat> =
  PF['proofFormats']['selectCredentialsForRequest']['output']

export interface ProofFormatAutoRespondProposalOptions {
  proofRecord: DidCommProofExchangeRecord
  proposalAttachment: DidCommAttachment
  requestAttachment: DidCommAttachment
}

export interface ProofFormatAutoRespondRequestOptions {
  proofRecord: DidCommProofExchangeRecord
  requestAttachment: DidCommAttachment
  proposalAttachment: DidCommAttachment
}

export interface ProofFormatAutoRespondPresentationOptions {
  proofRecord: DidCommProofExchangeRecord
  proposalAttachment?: DidCommAttachment
  requestAttachment: DidCommAttachment
  presentationAttachment: DidCommAttachment
}
