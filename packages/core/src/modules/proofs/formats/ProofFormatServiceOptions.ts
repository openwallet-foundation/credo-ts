import type { Attachment } from '../../../decorators/attachment/Attachment'
import type { BaseOptions } from '../ProofServiceOptions'
import type { GetRequestedCredentialsConfig } from '../models/GetRequestedCredentialsConfig'
import type { RequestPresentationOptions } from '../protocol'
import type { PresentationPreview } from '../protocol/v1/models/V1PresentationPreview'
import type { ProofExchangeRecord } from '../repository/ProofExchangeRecord'
import type { ProofAttachmentFormat } from './ProofAttachmentFormat'
import type { ProofFormat, ProofFormatPayload } from './ProofFormat'
import type { ProofFormatService } from './ProofFormatService'
import type { IndyProposeProofFormat, IndyRequestProofFormat, ProofRequest, ProofRequestOptions } from './indy'
import type { PresentationDefinitionV1 } from '@sphereon/pex-models'

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

export interface FormatProcessProposalOptions {
  proposal: ProofAttachmentFormat
  record?: ProofExchangeRecord
}

export interface FormatCreateProofRequestOptions {
  id?: string
  formats: ProposeProofFormats
}

export interface FormatProcessRequestOptions {
  requestAttachment: ProofAttachmentFormat
  record?: ProofExchangeRecord
}

export interface FormatProcessPresentationOptions {
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

export interface FormatPresentationAttachment {
  presentationAttachment: Attachment
  presentationOptions?: PresentationOptions
}

export interface ProposeProofFormats {
  indy?: IndyProposeProofFormat
  presentationExchange?: ProposePresentationExchangeOptions
}

export interface RequestProofFormats {
  indy?: IndyRequestProofFormat
  presentationExchange?: RequestPresentationOptions
}

export interface FormatProofRequestOptions {
  indy?: ProofRequest
  presentationExchange?: FormatRequestPresentationExchangeOptions
}

interface PresentationOptions {
  challenge?: string
  domain?: string
}

export interface FormatRequestPresentationExchangeOptions {
  options?: PresentationOptions
  presentationDefinition: PresentationDefinitionV1
}

export interface ProposePresentationExchangeOptions {
  presentationDefinition: PresentationDefinitionV1
}

export interface FormatCreateRequestAsResponseOptions<PFs extends ProofFormat[]> extends BaseOptions {
  id?: string
  proofRecord: ProofExchangeRecord
  proofFormats: ProofFormatPayload<PFs, 'createRequestAsResponse'>
}

export interface FormatRequestedCredentialReturn<PFs extends ProofFormat[]> {
  proofFormats: ProofFormatPayload<PFs, 'requestCredentials'>
}

export interface FormatRetrievedCredentialOptions<PFs extends ProofFormat[]> {
  proofFormats: ProofFormatPayload<PFs, 'retrieveCredentials'>
}
