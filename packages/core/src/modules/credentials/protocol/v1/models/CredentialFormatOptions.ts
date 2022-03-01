import type { LinkedAttachment } from '../../../../../../src/utils/LinkedAttachment'
import type { CredentialPreviewAttribute } from '../../../models/CredentialPreviewAttributes'
import type { CredOffer, CredReq, Cred, CredReqMetadata } from 'indy-sdk'

export interface CredPropose {
  attributes?: CredentialPreviewAttribute[]
  schemaIssuerDid?: string
  schemaName?: string
  schemaVersion?: string
  schemaId?: string
  issuerDid?: string
  credentialDefinitionId?: string
  linkedAttachments?: LinkedAttachment[]
}

export interface Payload {
  credentialPayload?: CredOffer | CredReq | CredPropose | Cred
  requestMetaData?: CredReqMetadata
}
