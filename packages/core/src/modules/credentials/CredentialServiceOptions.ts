import type { AgentMessage } from '../../agent/AgentMessage'
import type { ConnectionRecord } from '../connections/repository/ConnectionRecord'
import type { CredentialFormat, CredentialFormatPayload } from './formats/CredentialFormat'
import type { AutoAcceptCredential } from './models/CredentialAutoAcceptType'
import type { CredentialExchangeRecord } from './repository/CredentialExchangeRecord'

export interface CreateProposalOptions<CFs extends CredentialFormat[]> {
  connection: ConnectionRecord
  credentialFormats: CredentialFormatPayload<CFs, 'createProposal'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface AcceptProposalOptions<CFs extends CredentialFormat[]> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats?: CredentialFormatPayload<CFs, 'acceptProposal'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface NegotiateProposalOptions<CFs extends CredentialFormat[]> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats: CredentialFormatPayload<CFs, 'createOffer'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface CreateOfferOptions<CFs extends CredentialFormat[]> {
  // Create offer can also be used for connection-less, so connection is optional
  connection?: ConnectionRecord
  credentialFormats: CredentialFormatPayload<CFs, 'createOffer'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface AcceptOfferOptions<CFs extends CredentialFormat[]> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats?: CredentialFormatPayload<CFs, 'acceptOffer'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface NegotiateOfferOptions<CFs extends CredentialFormat[]> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats: CredentialFormatPayload<CFs, 'createProposal'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface CreateRequestOptions<CFs extends CredentialFormat[]> {
  connection: ConnectionRecord
  credentialFormats: CredentialFormatPayload<CFs, 'createRequest'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface AcceptRequestOptions<CFs extends CredentialFormat[]> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats?: CredentialFormatPayload<CFs, 'acceptRequest'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface AcceptCredentialOptions {
  credentialRecord: CredentialExchangeRecord
}

export interface CredentialProtocolMsgReturnType<MessageType extends AgentMessage> {
  message: MessageType
  credentialRecord: CredentialExchangeRecord
}

export interface DeleteCredentialOptions {
  deleteAssociatedCredentials: boolean
  deleteAssociatedDidCommMessages: boolean
}
