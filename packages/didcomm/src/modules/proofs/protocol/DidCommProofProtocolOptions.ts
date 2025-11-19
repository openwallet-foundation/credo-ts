import type { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommConnectionRecord } from '../../connections'
import type {
  DidCommProofFormat,
  DidCommProofFormatCredentialForRequestPayload,
  DidCommProofFormatPayload,
  DidCommProofFormatService,
  ExtractProofFormats,
} from '../formats'
import type { DidCommAutoAcceptProof } from '../models'
import type { DidCommProofExchangeRecord } from '../repository'
import type { DidCommProofProtocol } from './DidCommProofProtocol'

/**
 * Get the format data payload for a specific message from a list of ProofFormat interfaces and a message
 *
 * For an indy offer, this resolves to the proof request format as defined here:
 * https://github.com/hyperledger/aries-rfcs/tree/b3a3942ef052039e73cd23d847f42947f8287da2/features/0592-indy-attachments#proof-request-format
 *
 * @example
 * ```
 *
 * type RequestFormatData = ProofFormatDataMessagePayload<[IndyProofFormat, PresentationExchangeProofFormat], 'createRequest'>
 *
 * // equal to
 * type RequestFormatData = {
 *  indy: {
 *   // ... payload for indy proof request attachment as defined in RFC 0592 ...
 *  },
 *  presentationExchange: {
 *   // ... payload for presentation exchange request attachment as defined in RFC 0510 ...
 *  }
 * }
 * ```
 */
export type ProofFormatDataMessagePayload<
  CFs extends DidCommProofFormat[] = DidCommProofFormat[],
  M extends keyof DidCommProofFormat['formatData'] = keyof DidCommProofFormat['formatData'],
> = {
  [ProofFormat in CFs[number] as ProofFormat['formatKey']]?: ProofFormat['formatData'][M]
}

/**
 * Infer the {@link DidCommProofFormat} types based on an array of {@link DidCommProofProtocol} types.
 *
 * It does this by extracting the `ProofFormatServices` generic from the `DidCommProofProtocol`, and
 * then extracting the `ProofFormat` generic from each of the `ProofFormatService` types.
 *
 * @example
 * ```
 * // TheProofFormatServices is now equal to [IndyProofFormatService]
 * type TheProofFormatServices = ProofFormatsFromProtocols<[DidCommProofV1Protocol]>
 * ```
 *
 * Because the `DidCommProofV1Protocol` is defined as follows:
 * ```
 * class DidCommProofV1Protocol implements DidCommProofProtocol<[IndyProofFormatService]> {
 * }
 * ```
 */
export type ProofFormatsFromProtocols<Type extends DidCommProofProtocol[]> = Type[number] extends DidCommProofProtocol<
  infer ProofFormatServices
>
  ? ProofFormatServices extends DidCommProofFormatService[]
    ? ExtractProofFormats<ProofFormatServices>
    : never
  : never

export type GetProofFormatDataReturn<PFs extends DidCommProofFormat[] = DidCommProofFormat[]> = {
  proposal?: ProofFormatDataMessagePayload<PFs, 'proposal'>
  request?: ProofFormatDataMessagePayload<PFs, 'request'>
  presentation?: ProofFormatDataMessagePayload<PFs, 'presentation'>
}

interface BaseOptions {
  comment?: string
  autoAcceptProof?: DidCommAutoAcceptProof

  /**
   * Will be ignored for v1 protocol as it is not supported
   */
  goalCode?: string

  /**
   * Will be ignored for v1 protocol as it is not supported
   */
  goal?: string
}

export interface CreateProofProposalOptions<PFs extends DidCommProofFormatService[]> extends BaseOptions {
  connectionRecord?: DidCommConnectionRecord
  proofFormats: DidCommProofFormatPayload<ExtractProofFormats<PFs>, 'createProposal'>
  parentThreadId?: string
}

export interface AcceptProofProposalOptions<PFs extends DidCommProofFormatService[]> extends BaseOptions {
  proofRecord: DidCommProofExchangeRecord
  proofFormats?: DidCommProofFormatPayload<ExtractProofFormats<PFs>, 'acceptProposal'>

  /** @default true */
  willConfirm?: boolean
}

export interface NegotiateProofProposalOptions<PFs extends DidCommProofFormatService[]> extends BaseOptions {
  proofRecord: DidCommProofExchangeRecord
  proofFormats: DidCommProofFormatPayload<ExtractProofFormats<PFs>, 'createRequest'>

  /** @default true */
  willConfirm?: boolean
}

export interface CreateProofRequestOptions<PFs extends DidCommProofFormatService[]> extends BaseOptions {
  // Create request can also be used for connection-less, so connection is optional
  connectionRecord?: DidCommConnectionRecord
  proofFormats: DidCommProofFormatPayload<ExtractProofFormats<PFs>, 'createRequest'>
  parentThreadId?: string

  /** @default true */
  willConfirm?: boolean
}

export interface AcceptProofRequestOptions<PFs extends DidCommProofFormatService[]> extends BaseOptions {
  proofRecord: DidCommProofExchangeRecord
  proofFormats?: DidCommProofFormatPayload<ExtractProofFormats<PFs>, 'acceptRequest'>
}

export interface NegotiateProofRequestOptions<PFs extends DidCommProofFormatService[]> extends BaseOptions {
  proofRecord: DidCommProofExchangeRecord
  proofFormats: DidCommProofFormatPayload<ExtractProofFormats<PFs>, 'createProposal'>
}

export interface GetCredentialsForRequestOptions<PFs extends DidCommProofFormatService[]> {
  proofRecord: DidCommProofExchangeRecord
  proofFormats?: DidCommProofFormatCredentialForRequestPayload<
    ExtractProofFormats<PFs>,
    'getCredentialsForRequest',
    'input'
  >
}

export interface GetCredentialsForRequestReturn<PFs extends DidCommProofFormatService[]> {
  proofFormats: DidCommProofFormatCredentialForRequestPayload<
    ExtractProofFormats<PFs>,
    'getCredentialsForRequest',
    'output'
  >
}

export interface SelectCredentialsForRequestOptions<PFs extends DidCommProofFormatService[]> {
  proofRecord: DidCommProofExchangeRecord
  proofFormats?: DidCommProofFormatCredentialForRequestPayload<
    ExtractProofFormats<PFs>,
    'selectCredentialsForRequest',
    'input'
  >
}

export interface SelectCredentialsForRequestReturn<PFs extends DidCommProofFormatService[]> {
  proofFormats: DidCommProofFormatCredentialForRequestPayload<
    ExtractProofFormats<PFs>,
    'selectCredentialsForRequest',
    'output'
  >
}

export interface AcceptPresentationOptions {
  proofRecord: DidCommProofExchangeRecord
}

export interface CreateProofProblemReportOptions {
  proofRecord: DidCommProofExchangeRecord
  description: string
}

export interface ProofProtocolMsgReturnType<MessageType extends DidCommMessage> {
  message: MessageType
  proofRecord: DidCommProofExchangeRecord
}

export interface DeleteProofOptions {
  deleteAssociatedDidCommMessages?: boolean
}
