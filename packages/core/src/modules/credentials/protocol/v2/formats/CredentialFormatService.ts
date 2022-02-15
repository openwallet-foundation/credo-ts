import type { AutoAcceptCredential } from '../../..'
import type { LinkedAttachment } from '../../../../../utils/LinkedAttachment'
import type { EventEmitter } from '../../../../../agent/EventEmitter'
import type { Attachment } from '../../../../../decorators/attachment/Attachment'
import type { CredentialPreviewAttribute } from '../../../CredentialPreviewAttributes'
import type {
  AcceptProposalOptions,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
  V2CredDefinitionFormat,
  W3CCredentialFormat,
} from '../../../interfaces'
import type { CredentialExchangeRecord, CredentialRepository } from '../../../repository'
import type { V1CredentialPreview } from '../../v1/V1CredentialPreview'
import type { V2CredentialPreview } from '../V2CredentialPreview'
import type { V2IssueCredentialMessage } from '../messages/V2IssueCredentialMessage'
import type { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'
import type { V2ProposeCredentialMessage } from '../messages/V2ProposeCredentialMessage'
import type { V2RequestCredentialMessage } from '../messages/V2RequestCredentialMessage'
import type { MetaDataService } from './MetaDataService'
import type { CredReq, CredReqMetadata, CredOffer, Cred } from 'indy-sdk'

import { uuid } from '../../../../../utils/uuid'
import { CredentialFormatType } from '../../../interfaces'

export interface CredPropose {
  attributes?: CredentialPreviewAttribute[]
  schemaIssuerDid?: string
  schemaName?: string
  schemaVersion?: string
  schemaId?: string
  issuerDid?: string
  credentialDefinitionId?: string
  linkedAttachments?: LinkedAttachment[]
  cred_def_id?: string
}

export type V2CredentialFormatSpec = {
  attachId: string
  format: string
}

type FormatKeys = {
  [id: string]: CredentialFormatType
}

export const FORMAT_KEYS: FormatKeys = {
  indy: CredentialFormatType.Indy,
  jsonld: CredentialFormatType.JsonLd,
}

export interface Payload {
  credentialPayload?: CredOffer | CredReq | CredPropose | Cred
  requestMetaData?: CredReqMetadata
}

export interface V2CredProposalFormat {
  indy?: CredPropose
  jsonld?: W3CCredentialFormat
}

export interface V2CredProposeOfferRequestFormat {
  indy?: {
    payload: Payload
  }
  jsonld?: W3CCredentialFormat
}

export interface V2AttachmentFormats {
  preview?: V2CredentialPreview
  formats: V2CredentialFormatSpec
  filtersAttach?: Attachment
  offersAttach?: Attachment
  requestAttach?: Attachment
  credentialsAttach?: Attachment
  previewWithAttachments?: V2CredentialPreview // indy only
  credOfferRequest?: V2CredProposeOfferRequestFormat
}

export abstract class CredentialFormatService {
  abstract getAttachment(
    message: V2RequestCredentialMessage | V2ProposeCredentialMessage | V2OfferCredentialMessage
  ): Attachment | undefined
  protected credentialRepository: CredentialRepository
  protected eventEmitter: EventEmitter

  public constructor(credentialRepository: CredentialRepository, eventEmitter: EventEmitter) {
    this.credentialRepository = credentialRepository
    this.eventEmitter = eventEmitter
  }

  // PROPOSE METHODS
  abstract processProposal(
    options: AcceptProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<AcceptProposalOptions>
  abstract createProposalAttachFormats(proposal: ProposeCredentialOptions): V2AttachmentFormats
  abstract shouldAutoRespondToProposal(
    credentialRecord: CredentialExchangeRecord,
    autoAcceptType: AutoAcceptCredential,
    proposeMessage: V2ProposeCredentialMessage,
    offerMessage?: V2OfferCredentialMessage
  ): boolean

  // OFFER METHODS
  abstract createOffer(
    proposal: AcceptProposalOptions | NegotiateProposalOptions | OfferCredentialOptions
  ): Promise<V2CredProposeOfferRequestFormat>
  abstract createOfferAttachFormats(
    proposal: AcceptProposalOptions | NegotiateProposalOptions | OfferCredentialOptions,
    offer: V2CredProposeOfferRequestFormat
  ): V2AttachmentFormats
  abstract shouldAutoRespondToOffer(
    credentialRecord: CredentialExchangeRecord,
    autoAcceptType: AutoAcceptCredential,
    proposeMessage?: V2ProposeCredentialMessage,
    offerMessage?: V2OfferCredentialMessage
  ): boolean

  // REQUEST METHODS
  abstract createRequestAttachFormats(
    requestOptions: RequestCredentialOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<V2AttachmentFormats>
  abstract shouldAutoRespondToRequest(
    credentialRecord: CredentialExchangeRecord,
    autoAcceptType: AutoAcceptCredential,
    requestMessage: V2RequestCredentialMessage,
    proposeMessage?: V2ProposeCredentialMessage,
    offerMessage?: V2OfferCredentialMessage
  ): boolean

  // ISSUE METHODS
  abstract createIssueAttachFormats(credentialRecord: CredentialExchangeRecord): Promise<V2AttachmentFormats>
  abstract processCredential(
    message: V2IssueCredentialMessage,
    credentialRecord: CredentialExchangeRecord
  ): Promise<void>
  abstract shouldAutoRespondToIssue(
    credentialRecord: CredentialExchangeRecord,
    credentialMessage: V2IssueCredentialMessage,
    autoAcceptType: AutoAcceptCredential
  ): boolean

  // helper methods

  abstract getCredentialDefinition(offer: V2CredProposeOfferRequestFormat): Promise<V2CredDefinitionFormat | undefined>
  abstract getCredentialPayload(data: Attachment): V2CredProposeOfferRequestFormat
  abstract getFormatData(data: unknown, id: string): Attachment
  abstract getCredentialAttributes(proposal: ProposeCredentialOptions): CredentialPreviewAttribute[] | undefined
  abstract setPreview(proposal: AcceptProposalOptions, preview: V1CredentialPreview): AcceptProposalOptions

  abstract getMetaDataService(): MetaDataService
  public generateId(): string {
    return uuid()
  }

  public getType(): string {
    return this.constructor.name
  }
}
