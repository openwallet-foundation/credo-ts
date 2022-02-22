import type { AutoAcceptCredential } from '..'
import type { EventEmitter } from '../../../agent/EventEmitter'
import type { Attachment } from '../../../decorators/attachment/Attachment'
import type { LinkedAttachment } from '../../../utils/LinkedAttachment'
import type { CredentialPreviewAttribute } from '../CredentialPreviewAttributes'
import type {
  AcceptProposalOptions,
  AcceptRequestOptions,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
  W3CCredentialFormat,
} from '../interfaces'
import type { V1CredentialPreview } from '../protocol/v1/V1CredentialPreview'
import type { V2CredentialPreview } from '../protocol/v2/V2CredentialPreview'
import type { V2IssueCredentialMessage } from '../protocol/v2/messages/V2IssueCredentialMessage'
import type { V2OfferCredentialMessage } from '../protocol/v2/messages/V2OfferCredentialMessage'
import type { V2ProposeCredentialMessage } from '../protocol/v2/messages/V2ProposeCredentialMessage'
import type { V2RequestCredentialMessage } from '../protocol/v2/messages/V2RequestCredentialMessage'
import type { CredentialExchangeRecord, CredentialRepository } from '../repository'
import type { MetaDataService } from './MetaDataService'
import type { CredentialDefinitionFormat } from './models/CredentialFormatServiceOptions'
import type { CredReq, CredReqMetadata, CredOffer, Cred } from 'indy-sdk'

import { uuid } from '../../../utils/uuid'
import { CredentialFormatType } from '../interfaces'

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

export type CredentialFormatSpec = {
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

export interface CredProposeOfferRequestFormat {
  indy?: {
    payload: Payload
  }
  jsonld?: W3CCredentialFormat
}

export interface CredAttachmentFormats {
  preview?: V2CredentialPreview
  formats: CredentialFormatSpec
  filtersAttach?: Attachment
  offersAttach?: Attachment
  requestAttach?: Attachment
  credentialsAttach?: Attachment
  previewWithAttachments?: V2CredentialPreview // indy only
  credOfferRequest?: CredProposeOfferRequestFormat
}

export abstract class CredentialFormatService {
  abstract getAttachment(
    message:
      | V2RequestCredentialMessage
      | V2ProposeCredentialMessage
      | V2OfferCredentialMessage
      | V2IssueCredentialMessage
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
  abstract createProposalAttachFormats(proposal: ProposeCredentialOptions): CredAttachmentFormats

  // OFFER METHODS
  abstract createOffer(
    proposal: AcceptProposalOptions | NegotiateProposalOptions | OfferCredentialOptions
  ): Promise<CredProposeOfferRequestFormat>
  abstract createOfferAttachFormats(
    proposal: AcceptProposalOptions | NegotiateProposalOptions | OfferCredentialOptions,
    offer: CredProposeOfferRequestFormat
  ): CredAttachmentFormats

  // REQUEST METHODS
  abstract createRequestAttachFormats(
    requestOptions: RequestCredentialOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredAttachmentFormats>

  // ISSUE METHODS
  abstract createIssueAttachFormats(
    options: AcceptRequestOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredAttachmentFormats>
  abstract processCredential(
    message: V2IssueCredentialMessage,
    credentialRecord: CredentialExchangeRecord
  ): Promise<void>

  // helper methods

  abstract getCredentialDefinition(
    offer: CredProposeOfferRequestFormat
  ): Promise<CredentialDefinitionFormat | undefined>
  abstract getCredentialPayload(data: Attachment): CredProposeOfferRequestFormat
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

  // credential response coordinator methods
  abstract shouldAutoRespondToProposal(
    credentialRecord: CredentialExchangeRecord,
    autoAcceptType: AutoAcceptCredential,
    proposeMessageAttributes?: CredentialPreviewAttribute[],
    proposePayload?: CredProposeOfferRequestFormat,
    offerPayload?: CredProposeOfferRequestFormat
  ): boolean

  abstract shouldAutoRespondToOffer(
    credentialRecord: CredentialExchangeRecord,
    autoAcceptType: AutoAcceptCredential,
    offerPayload?: CredProposeOfferRequestFormat,
    offerMessageAttributes?: CredentialPreviewAttribute[],
    proposePayload?: CredProposeOfferRequestFormat
  ): boolean

  abstract shouldAutoRespondToRequest(
    credentialRecord: CredentialExchangeRecord,
    autoAcceptType: AutoAcceptCredential,
    requestPayload?: CredProposeOfferRequestFormat,
    offerPayload?: CredProposeOfferRequestFormat,
    proposePayload?: CredProposeOfferRequestFormat
  ): boolean

  abstract shouldAutoRespondToIssue(
    credentialRecord: CredentialExchangeRecord,
    autoAcceptType: AutoAcceptCredential,
    credentialPayload?: CredProposeOfferRequestFormat
  ): boolean
}
