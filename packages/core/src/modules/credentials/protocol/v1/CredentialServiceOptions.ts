import type { AgentMessage } from '../../../../agent/AgentMessage'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { LinkedAttachment } from '../../../../utils/LinkedAttachment'
import type { AutoAcceptCredential } from '../../CredentialAutoAcceptType'
import type { CredentialExchangeRecord } from '../../repository/CredentialRecord'
import type { V1CredentialPreview } from './V1CredentialPreview'
import type { ProposeCredentialMessageOptions } from './messages'

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

export interface CredentialResponseOptions {
  comment?: string
  autoAcceptCredential?: AutoAcceptCredential
}

export type CredentialProposeOptions = Omit<ProposeCredentialMessageOptions, 'id'> & {
  linkedAttachments?: LinkedAttachment[]
  autoAcceptCredential?: AutoAcceptCredential
}
