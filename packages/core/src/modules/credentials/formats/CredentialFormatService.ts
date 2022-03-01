import type { AutoAcceptCredential } from '..'
import type { EventEmitter } from '../../../agent/EventEmitter'
import type { Attachment } from '../../../decorators/attachment/Attachment'
import type {
  AcceptProposalOptions,
  AcceptRequestOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../interfaces'
import type { CredentialPreviewAttribute } from '../models/CredentialPreviewAttributes'
import type { V1CredentialPreview } from '../protocol/v1/V1CredentialPreview'
import type { V2IssueCredentialMessage } from '../protocol/v2/messages/V2IssueCredentialMessage'
import type { CredentialExchangeRecord, CredentialRepository } from '../repository'
import type {
  CredentialAttachmentFormats,
  CredProposeOfferRequestFormat,
  OfferAttachmentFormats,
  ProposeAttachmentFormats,
} from './models/CredentialFormatServiceOptions'

import { uuid } from '../../../utils/uuid'

export abstract class CredentialFormatService {
  protected credentialRepository: CredentialRepository
  protected eventEmitter: EventEmitter

  public constructor(credentialRepository: CredentialRepository, eventEmitter: EventEmitter) {
    this.credentialRepository = credentialRepository
    this.eventEmitter = eventEmitter
  }

  abstract createProposal(options: ProposeCredentialOptions): ProposeAttachmentFormats

  abstract processProposal(
    options: AcceptProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<AcceptProposalOptions>

  abstract createOffer(options: AcceptProposalOptions): Promise<OfferAttachmentFormats>

  abstract processOffer(
    credentialOffer: CredProposeOfferRequestFormat,
    credentialRecord: CredentialExchangeRecord
  ): void

  abstract createRequest(
    options: RequestCredentialOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialAttachmentFormats>

  abstract processRequest(
    credentialRequest: CredProposeOfferRequestFormat,
    credentialRecord: CredentialExchangeRecord
  ): void

  abstract createCredential(
    options: AcceptRequestOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialAttachmentFormats>

  abstract processCredential(
    message: V2IssueCredentialMessage,
    credentialRecord: CredentialExchangeRecord
  ): Promise<void>

  // helper methods

  abstract getCredentialPayload(data: Attachment): CredProposeOfferRequestFormat
  abstract getFormatData(data: unknown, id: string): Attachment
  abstract getCredentialAttributes(proposal: ProposeCredentialOptions): CredentialPreviewAttribute[] | undefined
  abstract setPreview(proposal: AcceptProposalOptions, preview: V1CredentialPreview): AcceptProposalOptions

  public generateId(): string {
    return uuid()
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

  abstract shouldAutoRespondToCredential(
    credentialRecord: CredentialExchangeRecord,
    autoAcceptType: AutoAcceptCredential,
    credentialPayload?: CredProposeOfferRequestFormat
  ): boolean
}
