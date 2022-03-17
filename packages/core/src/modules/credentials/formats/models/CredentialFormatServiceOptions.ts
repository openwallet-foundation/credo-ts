import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { AutoAcceptCredential } from '../../CredentialAutoAcceptType'
import type { CredentialPreviewAttribute } from '../../models/CredentialPreviewAttributes'
import type { CredPropose } from '../../protocol/v1/models/CredentialFormatOptions'
import type { V2CredentialPreview } from '../../protocol/v2/V2CredentialPreview'
import type { CredentialExchangeRecord } from '../../repository/CredentialExchangeRecord'
import type { Cred, CredDef, CredOffer, CredReq } from 'indy-sdk'

import { CredentialFormatType } from '../../interfaces'

export type CredProposeOfferRequestFormat =
  | CredentialOfferFormat
  | CredentialProposeFormat
  | CredentialRequestFormat
  | CredentialIssueFormat

export interface CredentialDefinitionFormat {
  indy?: {
    credDef: CredDef
  }
  w3c?: {
    // todo
  }
}

export interface CredentialOfferFormat {
  indy?: {
    payload: {
      credentialPayload: CredOffer
    }
  }
}

export interface CredentialProposeFormat {
  indy?: {
    payload: {
      credentialPayload: CredPropose
    }
  }
}
export interface CredentialRequestFormat {
  indy?: {
    credentialDefinitionId?: string
    attributes?: CredentialPreviewAttribute[]
    payload?: {
      credentialPayload: CredReq
    }
  }
}

export interface CredentialIssueFormat {
  indy?: {
    payload: {
      credentialPayload: Cred
    }
  }
}
export type CredentialFormatSpec = {
  attachId: string
  format: string
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

export interface HandlerAutoAcceptOptions {
  credentialRecord: CredentialExchangeRecord
  autoAcceptType: AutoAcceptCredential
  messageAttributes?: CredentialPreviewAttribute[]
  proposalAttachment?: Attachment
  offerAttachment?: Attachment
  requestAttachment?: Attachment
  credentialAttachment?: Attachment
}
