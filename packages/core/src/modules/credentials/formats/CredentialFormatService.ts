import type { EventEmitter } from '../../../agent/EventEmitter'
import type {
  AcceptCredentialOptions,
  ServiceAcceptOfferOptions,
  ServiceAcceptProposalOptions,
} from '../CredentialServiceOptions'
import type {
  AcceptRequestOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../CredentialsModuleOptions'
import type { CredentialExchangeRecord, CredentialRepository } from '../repository'
import type {
  FormatServiceCredentialAttachmentFormats,
  CredentialFormatSpec,
  HandlerAutoAcceptOptions,
  FormatServiceOfferAttachmentFormats,
  FormatServiceProposeAttachmentFormats,
  RevocationRegistry,
} from './models/CredentialFormatServiceOptions'

import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { JsonEncoder } from '../../../utils/JsonEncoder'

export abstract class CredentialFormatService {
  protected credentialRepository: CredentialRepository
  protected eventEmitter: EventEmitter

  public constructor(credentialRepository: CredentialRepository, eventEmitter: EventEmitter) {
    this.credentialRepository = credentialRepository
    this.eventEmitter = eventEmitter
  }

  abstract createProposal(options: ProposeCredentialOptions): FormatServiceProposeAttachmentFormats

  abstract processProposal(
    options: ServiceAcceptProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<void>

  abstract createOffer(proposal: ServiceAcceptOfferOptions): Promise<FormatServiceOfferAttachmentFormats>

  abstract processOffer(attachment: Attachment, credentialRecord: CredentialExchangeRecord): Promise<void>

  abstract createRequest(
    options: RequestCredentialOptions,
    credentialRecord: CredentialExchangeRecord,
    holderDid?: string
  ): Promise<FormatServiceCredentialAttachmentFormats>

  abstract processRequest(options: RequestCredentialOptions, credentialRecord: CredentialExchangeRecord): void

  abstract createCredential(
    options: AcceptRequestOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<FormatServiceCredentialAttachmentFormats>

  abstract processCredential(
    options: AcceptCredentialOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<void>

  abstract shouldAutoRespondToProposal(options: HandlerAutoAcceptOptions): boolean
  abstract shouldAutoRespondToRequest(options: HandlerAutoAcceptOptions): boolean
  abstract shouldAutoRespondToCredential(options: HandlerAutoAcceptOptions): boolean

  abstract getRevocationRegistry(issueAttachment: Attachment): Promise<RevocationRegistry>

  /**
   *
   * Returns an object of type {@link Attachment} for use in credential exchange messages.
   * It looks up the correct format identifier and encodes the data as a base64 attachment.
   *
   * @param data The data to include in the attach object
   * @param id the attach id from the formats component of the message
   * @returns attachment to the credential proposal
   */
  public getFormatData(data: unknown, id: string): Attachment {
    const attachment: Attachment = new Attachment({
      id,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(data),
      }),
    })
    return attachment
  }

  /**
   * Gets the attachment object for a given attachId. We need to get out the correct attachId for
   * indy and then find the corresponding attachment (if there is one)
   * @param formats the formats object containing the attachid
   * @param messageAttachment the attachment containing the payload
   * @returns The Attachment if found or undefined
   */
  abstract getAttachment(formats: CredentialFormatSpec[], messageAttachment: Attachment[]): Attachment | undefined
}
