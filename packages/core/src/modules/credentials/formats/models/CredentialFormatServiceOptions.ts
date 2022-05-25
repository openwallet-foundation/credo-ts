import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { LinkedAttachment } from '../../../../utils/LinkedAttachment'
import type { ParseRevocationRegistryDefinitionTemplate } from '../../../ledger/services'
import type { AutoAcceptCredential } from '../../CredentialAutoAcceptType'
import type { CredentialPreviewAttribute } from '../../models/CredentialPreviewAttribute'
import type { V2CredentialPreview } from '../../protocol/v2/V2CredentialPreview'
import type { CredentialExchangeRecord } from '../../repository/CredentialExchangeRecord'
import type { CredPropose } from './CredPropose'

import { Expose } from 'class-transformer'
import { IsString } from 'class-validator'

import { CredentialFormatType } from '../../CredentialsModuleOptions'

export type CredentialFormats =
  | FormatServiceOfferCredentialFormats
  | FormatServiceProposeCredentialFormats
  | FormatServiceRequestCredentialFormats
export interface IndyCredentialPreview {
  credentialDefinitionId?: string
  attributes?: CredentialPreviewAttribute[]
}

export interface IndyProposeCredentialFormat {
  attributes?: CredentialPreviewAttribute[]
  linkedAttachments?: LinkedAttachment[]
  payload?: CredPropose
}
export interface IndyOfferCredentialFormat {
  credentialDefinitionId: string
  attributes: CredentialPreviewAttribute[]
  linkedAttachments?: LinkedAttachment[]
}
export interface IndyRequestCredentialFormat {
  credentialDefinitionId?: string
  attributes?: CredentialPreviewAttribute[]
}
export interface IndyIssueCredentialFormat {
  credentialDefinitionId?: string
  attributes?: CredentialPreviewAttribute[]
}

export class CredentialFormatSpec {
  public constructor(options: { attachId: string; format: string }) {
    if (options) {
      this.attachId = options.attachId
      this.format = options.format
    }
  }
  @Expose({ name: 'attach_id' })
  @IsString()
  public attachId!: string

  @IsString()
  public format!: string
}

export type FormatKeys = {
  [id: string]: CredentialFormatType
}

export interface FormatServiceCredentialAttachmentFormats {
  format: CredentialFormatSpec
  attachment: Attachment
}

export interface FormatServiceProposeAttachmentFormats extends FormatServiceCredentialAttachmentFormats {
  preview?: V2CredentialPreview
}

export interface FormatServiceOfferAttachmentFormats extends FormatServiceCredentialAttachmentFormats {
  preview?: V2CredentialPreview
}
export const FORMAT_KEYS: FormatKeys = {
  indy: CredentialFormatType.Indy,
}

export interface FormatServiceOfferCredentialFormats {
  indy?: IndyOfferCredentialFormat
  jsonld?: undefined
}

export interface FormatServiceProposeCredentialFormats {
  indy?: IndyProposeCredentialFormat
  jsonld?: undefined
}

export interface FormatServiceAcceptProposeCredentialFormats {
  indy?: {
    credentialDefinitionId?: string
    attributes: CredentialPreviewAttribute[]
    linkedAttachments?: LinkedAttachment[]
  }
  jsonld?: undefined
}

export interface FormatServiceRequestCredentialFormats {
  indy?: IndyRequestCredentialFormat
  jsonld?: undefined
}

export interface FormatServiceIssueCredentialFormats {
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
  credentialDefinitionId?: string
}

export interface RevocationRegistry {
  indy?: ParseRevocationRegistryDefinitionTemplate
  jsonld?: undefined
}
