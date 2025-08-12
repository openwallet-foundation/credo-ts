import type { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommConnectionRecord } from '../../connections'
import type {
  CredentialFormat,
  CredentialFormatPayload,
  CredentialFormatService,
  ExtractCredentialFormats,
} from '../formats'
import type { DidCommCredentialPreviewAttributeOptions } from '../models'
import type { DidCommAutoAcceptCredential } from '../models/DidCommCredentialAutoAcceptType'
import type { DidCommCredentialExchangeRecord } from '../repository/DidCommCredentialExchangeRecord'
import type { DidCommCredentialProtocol } from './DidCommCredentialProtocol'

/**
 * Get the format data payload for a specific message from a list of CredentialFormat interfaces and a message
 *
 * For an indy offer, this resolves to the cred abstract format as defined here:
 * https://github.com/hyperledger/aries-rfcs/tree/b3a3942ef052039e73cd23d847f42947f8287da2/features/0592-indy-attachments#cred-abstract-format
 *
 * @example
 * ```
 *
 * type OfferFormatData = CredentialFormatDataMessagePayload<[IndyCredentialFormat, JsonLdCredentialFormat], 'createOffer'>
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
export type CredentialFormatDataMessagePayload<
  CFs extends CredentialFormat[] = CredentialFormat[],
  M extends keyof CredentialFormat['formatData'] = keyof CredentialFormat['formatData'],
> = {
  [Service in CFs[number] as Service['formatKey']]?: Service['formatData'][M]
}

/**
 * Infer the {@link CredentialFormat} types based on an array of {@link DidCommCredentialProtocol} types.
 *
 * It does this by extracting the `CredentialFormatServices` generic from the `DidCommCredentialProtocol`, and
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
 * class V1CredentialProtocol implements DidCommCredentialProtocol<[IndyCredentialFormatService]> {
 * }
 * ```
 */
export type CredentialFormatsFromProtocols<Type extends DidCommCredentialProtocol[]> = Type[number] extends DidCommCredentialProtocol<
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
export type GetCredentialFormatDataReturn<CFs extends CredentialFormat[] = CredentialFormat[]> = {
  proposalAttributes?: DidCommCredentialPreviewAttributeOptions[]
  proposal?: CredentialFormatDataMessagePayload<CFs, 'proposal'>
  offer?: CredentialFormatDataMessagePayload<CFs, 'offer'>
  offerAttributes?: DidCommCredentialPreviewAttributeOptions[]
  request?: CredentialFormatDataMessagePayload<CFs, 'request'>
  credential?: CredentialFormatDataMessagePayload<CFs, 'credential'>
}

interface BaseOptions {
  comment?: string
  autoAcceptCredential?: DidCommAutoAcceptCredential

  /**
   * Will be ignored for v1 protocol as it is not supported
   */
  goalCode?: string

  /**
   * Will be ignored for v1 protocol as it is not supported
   */
  goal?: string
}

export interface CreateCredentialProposalOptions<CFs extends CredentialFormatService[]> extends BaseOptions {
  connectionRecord: DidCommConnectionRecord
  credentialFormats: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'createProposal'>
}

export interface AcceptCredentialProposalOptions<CFs extends CredentialFormatService[]> extends BaseOptions {
  credentialRecord: DidCommCredentialExchangeRecord
  credentialFormats?: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'acceptProposal'>
}

export interface NegotiateCredentialProposalOptions<CFs extends CredentialFormatService[]> {
  credentialRecord: DidCommCredentialExchangeRecord
  credentialFormats: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'createOffer'>
  autoAcceptCredential?: DidCommAutoAcceptCredential
  comment?: string

  /**
   * Will be ignored for v1 protocol as it is not supported
   */
  goalCode?: string

  /**
   * Will be ignored for v1 protocol as it is not supported
   */
  goal?: string
}

export interface CreateCredentialOfferOptions<CFs extends CredentialFormatService[]> extends BaseOptions {
  // Create offer can also be used for connection-less, so connection is optional
  connectionRecord?: DidCommConnectionRecord
  credentialFormats: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'createOffer'>
}

export interface AcceptCredentialOfferOptions<CFs extends CredentialFormatService[]> extends BaseOptions {
  credentialRecord: DidCommCredentialExchangeRecord
  credentialFormats?: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'acceptOffer'>
}

export interface NegotiateCredentialOfferOptions<CFs extends CredentialFormatService[]> extends BaseOptions {
  credentialRecord: DidCommCredentialExchangeRecord
  credentialFormats: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'createProposal'>
}

export interface CreateCredentialRequestOptions<CFs extends CredentialFormatService[]> extends BaseOptions {
  connectionRecord: DidCommConnectionRecord
  credentialFormats: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'createRequest'>
}

export interface AcceptCredentialRequestOptions<CFs extends CredentialFormatService[]> extends BaseOptions {
  credentialRecord: DidCommCredentialExchangeRecord
  credentialFormats?: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'acceptRequest'>
}

export interface AcceptCredentialOptions {
  credentialRecord: DidCommCredentialExchangeRecord
}

export interface CreateCredentialProblemReportOptions {
  credentialRecord: DidCommCredentialExchangeRecord
  description: string
}

export interface CredentialProtocolMsgReturnType<MessageType extends DidCommMessage> {
  message: MessageType
  credentialRecord: DidCommCredentialExchangeRecord
}

export interface DeleteCredentialOptions {
  deleteAssociatedCredentials?: boolean
  deleteAssociatedDidCommMessages?: boolean
}
