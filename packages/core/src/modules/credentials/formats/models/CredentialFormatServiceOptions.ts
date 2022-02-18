import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { LinkedAttachment } from '../../../../utils/LinkedAttachment'
import type { CredentialPreviewAttribute } from '../../CredentialPreviewAttributes'
import type { W3CCredentialFormat } from '../../interfaces'
import type { V2CredentialPreview } from '../../protocol/v2/V2CredentialPreview'
import type { CredReq, CredReqMetadata, CredOffer, Cred, CredDef } from 'indy-sdk'

import { CredentialFormatType } from '../../interfaces'

export interface CredentialDefinitionFormat {
  indy?: {
    credDef: CredDef
  }
  w3c?: {}
}
export interface CredPropose {
  attributes?: CredentialPreviewAttribute[]
  schemaIssuerDid?: string
  schemaName?: string
  schemaVersion?: string
  schemaId?: string
  issuerDid?: string
  credentialDefinitionId?: string
  linkedAttachments?: LinkedAttachment[]
  cred_def_id?: string
}

export type CredentialFormatSpec = {
  attachId: string
  format: string
}

type FormatKeys = {
  [id: string]: CredentialFormatType
}

export const FORMAT_KEYS: FormatKeys = {
  indy: CredentialFormatType.Indy,
  jsonld: CredentialFormatType.JsonLd,
}

export interface Payload {
  credentialPayload?: CredOffer | CredReq | CredPropose | Cred
  requestMetaData?: CredReqMetadata
}

export interface CredProposeOfferRequestFormat {
  indy?: {
    payload: Payload
  }
  jsonld?: W3CCredentialFormat
}

export interface V2AttachmentFormats {
  preview?: V2CredentialPreview
  formats: CredentialFormatSpec
  filtersAttach?: Attachment
  offersAttach?: Attachment
  requestAttach?: Attachment
  credentialsAttach?: Attachment
  previewWithAttachments?: V2CredentialPreview // indy only
  credOfferRequest?: CredProposeOfferRequestFormat
}
