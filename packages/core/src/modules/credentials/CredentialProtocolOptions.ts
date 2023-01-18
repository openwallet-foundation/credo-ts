import type {
  CredentialFormat,
  CredentialFormatPayload,
  CredentialFormatService,
  ExtractCredentialFormats,
} from './formats'
import type { CredentialPreviewAttributeOptions } from './models'
import type { AutoAcceptCredential } from './models/CredentialAutoAcceptType'
import type { CredentialProtocol } from './protocol/CredentialProtocol'
import type { CredentialExchangeRecord } from './repository/CredentialExchangeRecord'
import type { AgentMessage } from '../../agent/AgentMessage'
import type { ConnectionRecord } from '../connections/repository/ConnectionRecord'

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
  [Service in CFs[number] as Service['formatKey']]?: Service['formatData'][M]
}

/**
 * Infer the {@link CredentialFormat} types based on an array of {@link CredentialProtocol} types.
 *
 * It does this by extracting the `CredentialFormatServices` generic from the `CredentialProtocol`, and
 * then extracting the `CredentialFormat` generic from each of the `CredentialFormatService` types.
 *
 * @example
 * ```
 * // TheCredentialFormatServices is now equal to [IndyCredentialFormatService]
 * type TheCredentialFormatServices = CredentialFormatsFromProtocols<[V1CredentialProtocol]>
 * ```
 *
 * Because the `V1CredentialProtocol` is defined as follows:
 * ```
 * class V1CredentialProtocol implements CredentialProtocol<[IndyCredentialFormatService]> {
 * }
 * ```
 */
export type CredentialFormatsFromProtocols<Type extends CredentialProtocol[]> = Type[number] extends CredentialProtocol<
  infer CredentialFormatServices
>
  ? CredentialFormatServices extends CredentialFormatService[]
    ? ExtractCredentialFormats<CredentialFormatServices>
    : never
  : never

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

export interface CreateProposalOptions<CFs extends CredentialFormatService[]> {
  connection: ConnectionRecord
  credentialFormats: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'createProposal'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface AcceptProposalOptions<CFs extends CredentialFormatService[]> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats?: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'acceptProposal'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface NegotiateProposalOptions<CFs extends CredentialFormatService[]> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'createOffer'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface CreateOfferOptions<CFs extends CredentialFormatService[]> {
  // Create offer can also be used for connection-less, so connection is optional
  connection?: ConnectionRecord
  credentialFormats: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'createOffer'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface AcceptOfferOptions<CFs extends CredentialFormatService[]> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats?: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'acceptOffer'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface NegotiateOfferOptions<CFs extends CredentialFormatService[]> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'createProposal'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface CreateRequestOptions<CFs extends CredentialFormatService[]> {
  connection: ConnectionRecord
  credentialFormats: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'createRequest'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface AcceptRequestOptions<CFs extends CredentialFormatService[]> {
  credentialRecord: CredentialExchangeRecord
  credentialFormats?: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'acceptRequest'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface AcceptCredentialOptions {
  credentialRecord: CredentialExchangeRecord
}

export interface CreateProblemReportOptions {
  message: string
}

export interface CredentialProtocolMsgReturnType<MessageType extends AgentMessage> {
  message: MessageType
  credentialRecord: CredentialExchangeRecord
}

export interface DeleteCredentialOptions {
  deleteAssociatedCredentials?: boolean
  deleteAssociatedDidCommMessages?: boolean
}
