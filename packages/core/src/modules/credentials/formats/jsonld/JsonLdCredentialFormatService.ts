/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/adjacent-overload-signatures */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { EventEmitter } from '../../../../agent/EventEmitter'
import type { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import type { ConnectionService } from '../../../connections/services/ConnectionService'
import type {
  AcceptCredentialOptions,
  ServiceCreateOfferOptions,
  ServiceAcceptProposalOptions,
} from '../../CredentialServiceOptions'
import type {
  AcceptProposalOptions,
  AcceptRequestOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../../CredentialsModuleOptions'
import type { CredentialExchangeRecord } from '../../repository'
import type { CredentialRepository } from '../../repository/CredentialRepository'
import type {
  CredentialFormatSpec,
  FormatServiceCredentialAttachmentFormats,
  FormatServiceOfferAttachmentFormats,
  FormatServiceProposeAttachmentFormats,
  HandlerAutoAcceptOptions,
  RevocationRegistry,
} from '../models/CredentialFormatServiceOptions'

import { AriesFrameworkError } from '../../../../../src/error'
import { uuid } from '../../../../../src/utils/uuid'
import { AutoAcceptCredential } from '../../CredentialAutoAcceptType'
import { CredentialResponseCoordinator } from '../../CredentialResponseCoordinator'
import { CredentialFormatService } from '../CredentialFormatService'

export class JsonLdCredentialFormatService extends CredentialFormatService {
  processOffer(attachment: Attachment, credentialRecord: CredentialExchangeRecord): Promise<void> {
    throw new Error('Method not implemented.')
  }
  createRequest(
    options: RequestCredentialOptions,
    credentialRecord: CredentialExchangeRecord,
    holderDid?: string
  ): Promise<FormatServiceCredentialAttachmentFormats> {
    throw new Error('Method not implemented.')
  }
  createCredential(
    options: AcceptRequestOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<FormatServiceCredentialAttachmentFormats> {
    throw new Error('Method not implemented.')
  }
  getRevocationRegistry(issueAttachment: Attachment): Promise<RevocationRegistry> {
    throw new Error('Method not implemented.')
  }
  getAttachment(formats: CredentialFormatSpec[], messageAttachment: Attachment[]): Attachment | undefined {
    throw new Error('Method not implemented.')
  }
  private connectionService: ConnectionService
  protected credentialRepository: CredentialRepository // protected as in base class

  public constructor(
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    connectionService: ConnectionService
  ) {
    super(credentialRepository, eventEmitter)
    this.credentialRepository = credentialRepository
    this.connectionService = connectionService
  }
  public async processProposal(
    options: ServiceAcceptProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<void> {
    // no meta data set for ld proofs
  }

  // public async createOffer(options: ServiceAcceptOfferOptions): Promise<OfferAttachmentFormats> {
  public async createOffer(options: ServiceAcceptProposalOptions): Promise<FormatServiceOfferAttachmentFormats> {
    const formats: CredentialFormatSpec = {
      attachId: uuid(),
      format: 'aries/ld-proof-vc-detail@v1.0',
    }
    // const offer = await this.createCredentialOffer(options)

    // if the proposal has an attachment Id use that, otherwise the generated id of the formats object
    const attachmentId = options.attachId ? options.attachId : formats.attachId

    const offersAttach: Attachment = this.getFormatData(options.proposalAttachment, attachmentId)

    return { format: formats, attachment: offersAttach }
  }

  public shouldAutoRespondToProposal(options: HandlerAutoAcceptOptions): boolean {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      options.credentialRecord.autoAcceptCredential,
      options.autoAcceptType
    )
    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    }
    if (options.proposalAttachment && options.offerAttachment) {
      if (this.areCredentialsEqual(options.proposalAttachment.data, options.offerAttachment.data)) {
        return true
      }
    }

    return false
  }

  private areCredentialsEqual(message1: AttachmentData, message2: AttachmentData): boolean {
    return JSON.stringify(message1) === JSON.stringify(message2)
  }

  shouldAutoRespondToRequest(options: HandlerAutoAcceptOptions): boolean {
    throw new Error('Method not implemented.')
  }
  shouldAutoRespondToCredential(options: HandlerAutoAcceptOptions): boolean {
    throw new Error('Method not implemented.')
  }

  processCredential(options: AcceptCredentialOptions, credentialRecord: CredentialExchangeRecord): Promise<void> {
    throw new Error('Method not implemented.')
  }
  processRequest(options: RequestCredentialOptions, credentialRecord: CredentialExchangeRecord): void {
    throw new Error('Method not implemented.')
  }

  public createProposal(options: ProposeCredentialOptions): FormatServiceProposeAttachmentFormats {
    const format: CredentialFormatSpec = {
      attachId: 'ld_proof',
      format: 'aries/ld-proof-vc-detail@v1.0',
    }

    const attachment: Attachment = this.getFormatData(options.credentialFormats.jsonld, format.attachId)
    return { format, attachment }
  }
}
