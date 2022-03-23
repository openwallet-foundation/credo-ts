import type { LinkedAttachment } from '../../../../../src/utils/LinkedAttachment'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { ParseRevocationRegistryDefitinionTemplate } from '../../../ledger/services'
import type { AutoAcceptCredential } from '../../CredentialAutoAcceptType'
import type { ServiceRequestCredentialOptions } from '../../CredentialServiceOptions'
import type { CredentialPreviewAttribute } from '../../models/CredentialPreviewAttributes'
import type { V2CredentialPreview } from '../../protocol/v2/V2CredentialPreview'
import type { CredentialExchangeRecord } from '../../repository/CredentialExchangeRecord'
import type { CredOffer, CredReq, Cred, CredDef } from 'indy-sdk'

import { Expose } from 'class-transformer'
import { IsString } from 'class-validator'

import { CredentialFormatType } from '../../CredentialsModuleOptions'

export type CredentialFormats = OfferCredentialFormats | ProposeCredentialFormats | RequestCredentialFormats
export interface IndyCredentialPreview {
  credentialDefinitionId?: string
  attributes?: CredentialPreviewAttribute[]
}

export interface CredPropose {
  schemaIssuerDid?: string
  schemaName?: string
  schemaVersion?: string
  schemaId?: string
  issuerDid?: string
  credentialDefinitionId?: string
}
export interface IndyProposeCredentialFormat {
  attributes: CredentialPreviewAttribute[]
  linkedAttachments?: LinkedAttachment[]
  payload?: CredPropose
}
export interface IndyOfferCredentialFormat {
  credentialDefinitionId: string
  attributes: CredentialPreviewAttribute[]
  linkedAttachments?: LinkedAttachment[]
  payload?: CredOffer
}
export interface IndyRequestCredentialFormat {
  credentialDefinitionId?: string
  attributes?: CredentialPreviewAttribute[]
  payload?: CredReq
}
export interface IndyIssueCredentialFormat {
  credentialDefinitionId?: string
  attributes?: CredentialPreviewAttribute[]
  payload?: Cred
}

export class CredentialFormatSpec {
  @Expose({ name: 'attach_id' })
  @IsString()
  public attachId!: string

  @IsString()
  public format!: string
}

export type FormatKeys = {
  [id: string]: CredentialFormatType
}

export interface CredentialAttachmentFormats {
  format: CredentialFormatSpec
  attachment?: Attachment
}

export interface ProposeAttachmentFormats extends CredentialAttachmentFormats {
  preview?: V2CredentialPreview
}

export interface OfferAttachmentFormats extends CredentialAttachmentFormats {
  preview?: V2CredentialPreview
}
export const FORMAT_KEYS: FormatKeys = {
  indy: CredentialFormatType.Indy,
}

export interface FormatServiceRequestCredentialOptions extends ServiceRequestCredentialOptions {
  credentialDefinition?: {
    credDef: CredDef
  }
}

export interface OfferCredentialFormats {
  indy?: IndyOfferCredentialFormat
  jsonld?: undefined
}

export interface ProposeCredentialFormats {
  indy?: IndyProposeCredentialFormat
  jsonld?: undefined
}

export interface RequestCredentialFormats {
  indy?: IndyRequestCredentialFormat
  jsonld?: undefined
}

export interface IssueCredentialFormats {
  indy?: IndyIssueCredentialFormat
  jsonld?: undefined
}

export interface HandlerAutoAcceptOptions {
  credentialRecord: CredentialExchangeRecord
  autoAcceptType: AutoAcceptCredential
  messageAttributes?: CredentialPreviewAttribute[]
  proposalAttachment?: Attachment
  offerAttachment?: Attachment
  requestAttachment?: Attachment
  credentialAttachment?: Attachment
}

export interface RevocationRegistry {
  indy?: ParseRevocationRegistryDefitinionTemplate
  jsonld?: undefined
}
