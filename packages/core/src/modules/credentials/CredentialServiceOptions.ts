import type { AgentMessage } from '../../agent/AgentMessage'
import type { Attachment } from '../../decorators/attachment/Attachment'
import type { LinkedAttachment } from '../../utils/LinkedAttachment'
import type { ConnectionRecord } from '../connections/repository/ConnectionRecord'
import type { AutoAcceptCredential } from './CredentialAutoAcceptType'
import type {
  AcceptOfferOptions,
  AcceptProposalOptions,
  AcceptRequestOptions,
  NegotiateOfferOptions,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  RequestCredentialOptions,
} from './CredentialsModuleOptions'
import type { CredentialPreviewAttribute } from './models/CredentialPreviewAttribute'
import type { V1CredentialPreview } from './protocol/v1/V1CredentialPreview'
import type { ProposeCredentialMessageOptions } from './protocol/v1/messages'
import type { CredentialExchangeRecord } from './repository/CredentialExchangeRecord'

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

export interface ServiceAcceptOfferOptions extends AcceptOfferOptions {
  attachId?: string
  credentialFormats: {
    indy?: IndyCredentialPreview
    jsonld?: {
      // todo
    }
  }
}

export interface ServiceOfferCredentialOptions extends OfferCredentialOptions {
  connection?: ConnectionRecord
  attachId?: string
  proposalAttachment?: Attachment
}

export interface ServiceAcceptProposalOptions extends AcceptProposalOptions {
  attachId?: string
  offerAttachment?: Attachment
  proposalAttachment?: Attachment
}

export interface ServiceAcceptRequestOptions extends AcceptRequestOptions {
  attachId?: string
}
export interface ServiceNegotiateProposalOptions extends NegotiateProposalOptions {
  offerAttachment?: Attachment
}

export interface ServiceNegotiateOfferOptions extends NegotiateOfferOptions {
  offerAttachment?: Attachment
}

export interface ServiceRequestCredentialOptions extends RequestCredentialOptions {
  attachId?: string
  offerAttachment?: Attachment
  requestAttachment?: Attachment
}

export interface ServiceAcceptCredentialOptions {
  credentialAttachment?: Attachment
}

export type CredentialProposeOptions = Omit<ProposeCredentialMessageOptions, 'id'> & {
  linkedAttachments?: LinkedAttachment[]
  autoAcceptCredential?: AutoAcceptCredential
}

export interface DeleteCredentialOptions {
  deleteAssociatedCredentials: boolean
}
