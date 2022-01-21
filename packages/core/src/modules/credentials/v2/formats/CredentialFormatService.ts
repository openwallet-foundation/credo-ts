import type { EventEmitter } from '../../../../agent/EventEmitter'
import type { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import type { CredentialPreviewAttribute } from '../../CredentialPreviewAttributes'
import type {
  AcceptProposalOptions,
  CredPropose,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
  V2CredDefinitionFormat,
  W3CCredentialFormat,
} from '../../interfaces'
import type { CredentialRecord, CredentialRepository } from '../../repository'
import type { V1CredentialPreview } from '../../v1/V1CredentialPreview'
import type { V2CredentialPreview } from '../V2CredentialPreview'
import type { V2CredentialFormatSpec } from '../formats/V2CredentialFormat'
import type { V2ProposeCredentialMessage } from '../messages/V2ProposeCredentialMessage'
import type { V2RequestCredentialMessage } from '../messages/V2RequestCredentialMessage'
import type { MetaDataService } from './MetaDataService'
import type { CredReq, CredReqMetadata, CredOffer } from 'indy-sdk'

import { uuid } from '../../../../utils/uuid'
import { CredentialFormatType } from '../CredentialExchangeRecord'

type FormatKeys = {
  [id: string]: CredentialFormatType
}

export const FORMAT_KEYS: FormatKeys = {
  indy: CredentialFormatType.Indy,
  jsonld: CredentialFormatType.JsonLd,
}

export interface Payload {
  credentialPayload?: CredOffer | CredReq | CredPropose
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
  previewWithAttachments?: V2CredentialPreview // indy only
  credOfferRequest?: V2CredProposeOfferRequestFormat
}

export abstract class CredentialFormatService {
  abstract getAttachment(message: V2RequestCredentialMessage | V2ProposeCredentialMessage): Attachment | undefined
  protected credentialRepository: CredentialRepository
  protected eventEmitter: EventEmitter

  public constructor(credentialRepository: CredentialRepository, eventEmitter: EventEmitter) {
    this.credentialRepository = credentialRepository
    this.eventEmitter = eventEmitter
  }

  // PROPOSE METHODS
  abstract processProposal(options: AcceptProposalOptions, credentialRecord: CredentialRecord): AcceptProposalOptions
  abstract createProposalAttachFormats(proposal: ProposeCredentialOptions, messageType: string): V2AttachmentFormats

  // OFFER METHODS
  abstract createOffer(
    proposal: AcceptProposalOptions | NegotiateProposalOptions | OfferCredentialOptions
  ): Promise<V2CredProposeOfferRequestFormat>
  abstract createOfferAttachFormats(
    proposal: AcceptProposalOptions | NegotiateProposalOptions | OfferCredentialOptions,
    offer: V2CredProposeOfferRequestFormat,
    messageType: string
  ): V2AttachmentFormats

  // REQUEST METHODS
  abstract createRequest(options: RequestCredentialOptions): Promise<V2CredProposeOfferRequestFormat>
  abstract getCredentialRequestAttachFormats(
    requestOptions: RequestCredentialOptions,
    credentialRecord: CredentialRecord
  ): Promise<V2AttachmentFormats>

  // helper methods
  abstract getCredentialDefinition(offer: V2CredProposeOfferRequestFormat): Promise<V2CredDefinitionFormat | undefined>
  abstract getCredentialPayload(data: AttachmentData): V2CredProposeOfferRequestFormat
  abstract getFormatIdentifier(messageType: string): V2CredentialFormatSpec
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
