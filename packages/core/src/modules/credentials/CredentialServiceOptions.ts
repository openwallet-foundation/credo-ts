import type { AgentMessage } from '../../agent/AgentMessage'
import type { ConnectionRecord } from '../connections/repository/ConnectionRecord'
import type { CredentialFormat, CredentialFormatPayload } from './formats'
import type { CredentialPreviewAttributeOptions } from './models'
import type { AutoAcceptCredential } from './models/CredentialAutoAcceptType'
import type { CredentialExchangeRecord } from './repository/CredentialExchangeRecord'

/**
 * Get the format data payload for a specific message from a list of CredentialFormat interfaces and a message
 *
 * For an indy offer, this resolves to the cred abstract format as defined here:
 * https://github.com/hyperledger/aries-rfcs/tree/b3a3942ef052039e73cd23d847f42947f8287da2/features/0592-indy-attachments#cred-abstract-format
 *
 * @example
 * ```
 *
 * type OfferFormatData = FormatDataMessagePayload<[IndyCredentialFormat, JsonLdCredentialFormat], 'offer'>
 *
 * // equal to
 * type OfferFormatData = {
 *  indy: {
 *   // ... payload for indy offer attachment as defined in RFC 0592 ...
 *  },
 *  jsonld: {
 *   // ... payload for jsonld offer attachment as defined in RFC 0593 ...
 *  }
 * }
 * ```
 */
export type FormatDataMessagePayload<
  CFs extends CredentialFormat[] = CredentialFormat[],
  M extends keyof CredentialFormat['formatData'] = keyof CredentialFormat['formatData']
> = {
  [CredentialFormat in CFs[number] as CredentialFormat['formatKey']]?: CredentialFormat['formatData'][M]
}

/**
 * Get format data return value. Each key holds a mapping of credential format key to format data.
 *
 * @example
 * ```
 * {
 *   proposal: {
 *     indy: {
 *       cred_def_id: string
 *     }
 *   }
 * }
 * ```
 */
export type GetFormatDataReturn<CFs extends CredentialFormat[] = CredentialFormat[]> = {
  proposalAttributes?: CredentialPreviewAttributeOptions[]
  proposal?: FormatDataMessagePayload<CFs, 'proposal'>
  offer?: FormatDataMessagePayload<CFs, 'offer'>
  offerAttributes?: CredentialPreviewAttributeOptions[]
  request?: FormatDataMessagePayload<CFs, 'request'>
  credential?: FormatDataMessagePayload<CFs, 'credential'>
}

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
