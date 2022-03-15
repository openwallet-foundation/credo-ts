import type { AgentMessage } from '../../agent/AgentMessage'
import type { Attachment } from '../../decorators/attachment/Attachment'
import type { LinkedAttachment } from '../../utils/LinkedAttachment'
import type { AutoAcceptCredential } from './CredentialAutoAcceptType'
import type {
  CredentialDefinitionFormat,
  CredentialRequestFormat,
  CredProposeOfferRequestFormat,
} from './formats/models/CredentialFormatServiceOptions'
import type { AcceptOfferOptions, RequestCredentialOptions, AcceptRequestOptions } from './interfaces'
import type { CredentialPreviewAttribute } from './models/CredentialPreviewAttributes'
import type { V1CredentialPreview } from './protocol/v1/V1CredentialPreview'
import type { ProposeCredentialMessageOptions } from './protocol/v1/messages'
import type { CredentialExchangeRecord } from './repository/CredentialRecord'

export interface IndyCredentialPreview {
  credentialDefinitionId?: string
  attributes?: CredentialPreviewAttribute[]
}

export interface CredentialProtocolMsgReturnType<MessageType extends AgentMessage> {
  message: MessageType
  credentialRecord: CredentialExchangeRecord
}

export interface CredentialOfferTemplate {
  credentialDefinitionId: string
  comment?: string
  preview: V1CredentialPreview
  autoAcceptCredential?: AutoAcceptCredential
  attachments?: Attachment[]
  linkedAttachments?: LinkedAttachment[]
}

export interface CredentialRequestOptions {
  holderDid: string
  comment?: string
  autoAcceptCredential?: AutoAcceptCredential
}

export interface ServiceAcceptOfferOptions extends AcceptOfferOptions {
  attachId?: string
  credentialFormats: {
    indy?: IndyCredentialPreview
    w3c?: {
      // todo
    }
  }
}

export interface ServiceRequestCredentialOptions extends RequestCredentialOptions {
  attachId?: string
  connectionId?: string
  // holderDid: string
  // As indy cannot start from request and w3c is not supported in v1 we always use v2 here
  credentialFormats?: CredentialRequestFormat
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
  offer?: CredProposeOfferRequestFormat // will not be there if this is a W3C request rather than an indy response to offer
  offerAttachment?: Attachment
  requestAttachment?: Attachment
  credentialDefinition?: CredentialDefinitionFormat
}

export interface ServiceAcceptRequestOptions extends AcceptRequestOptions {
  attachId?: string
}

export type CredentialProposeOptions = Omit<ProposeCredentialMessageOptions, 'id'> & {
  linkedAttachments?: LinkedAttachment[]
  autoAcceptCredential?: AutoAcceptCredential
}
