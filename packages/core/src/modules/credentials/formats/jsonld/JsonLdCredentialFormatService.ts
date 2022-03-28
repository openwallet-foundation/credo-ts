/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/adjacent-overload-signatures */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import type { W3cCredential } from '../../../vc/models'
import type {
  AcceptCredentialOptions,
  ServiceAcceptProposalOptions,
  ServiceAcceptRequestOptions,
} from '../../CredentialServiceOptions'
import type {
  AcceptProposalOptions,
  AcceptRequestOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../../CredentialsModuleOptions'
import type { CredentialExchangeRecord } from '../../repository'
import type {
  CredentialFormatSpec,
  FormatServiceCredentialAttachmentFormats,
  FormatServiceOfferAttachmentFormats,
  FormatServiceProposeAttachmentFormats,
  FormatServiceRequestCredentialOptions,
  HandlerAutoAcceptOptions,
  RevocationRegistry,
} from '../models/CredentialFormatServiceOptions'

import { Lifecycle, scoped } from 'tsyringe'

import { AriesFrameworkError } from '../../../../../src/error'
import { uuid } from '../../../../../src/utils/uuid'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { JsonEncoder } from '../../../../utils/JsonEncoder'
import { W3cCredentialService } from '../../../vc'
import { AutoAcceptCredential } from '../../CredentialAutoAcceptType'
import { CredentialResponseCoordinator } from '../../CredentialResponseCoordinator'
import { CredentialRepository } from '../../repository/CredentialRepository'
import { CredentialFormatService } from '../CredentialFormatService'

@scoped(Lifecycle.ContainerScoped)
export class JsonLdCredentialFormatService extends CredentialFormatService {
  protected credentialRepository: CredentialRepository // protected as in base class
  private w3cCredentialService: W3cCredentialService

  public constructor(
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    w3cCredentialService: W3cCredentialService
  ) {
    super(credentialRepository, eventEmitter)
    this.credentialRepository = credentialRepository
    this.w3cCredentialService = w3cCredentialService
  }
  public async processProposal(
    options: ServiceAcceptProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<void> {
    // no meta data set for ld proofs
  }

  processOffer(attachment: Attachment, credentialRecord: CredentialExchangeRecord): void {
    // not needed in jsonld
  }

  public async createCredential(
    options: ServiceAcceptRequestOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<FormatServiceCredentialAttachmentFormats> {
    if (!options.requestAttachment || !options.requestAttachment?.data?.base64) {
      throw new AriesFrameworkError(
        `Missing request attachment from request message, credential record id = ${credentialRecord.id}`
      )
    }

    const formats: CredentialFormatSpec = {
      attachId: uuid(),
      format: 'hlindy/cred-abstract@v2.0',
    }

    const attachmentId = options.attachId ? options.attachId : formats.attachId

    // sign credential here. The credential subject is received as the request attachment
    // (attachment in the request message from holder to issuer)
    const credential = options.requestAttachment?.getDataAsJson<W3cCredential>()

    const verifiableCredential = await this.w3cCredentialService.signCredential(credential)

    const issueAttachment: Attachment = this.getFormatData(verifiableCredential, attachmentId)

    return { format: formats, attachment: issueAttachment }
  }

  getRevocationRegistry(issueAttachment: Attachment): Promise<RevocationRegistry> {
    throw new Error('Method not implemented.')
  }

  getAttachment(formats: CredentialFormatSpec[], messageAttachment: Attachment[]): Attachment | undefined {
    const formatId = formats.find((f) => f.format.includes('aries'))
    const attachment = messageAttachment?.find((attachment) => attachment.id === formatId?.attachId)
    return attachment
  }

  public async createOffer(options: ServiceAcceptProposalOptions): Promise<FormatServiceOfferAttachmentFormats> {
    const formats: CredentialFormatSpec = {
      attachId: uuid(),
      format: 'aries/ld-proof-vc-detail@v1.0',
    }
    // if the proposal has an attachment Id use that, otherwise the generated id of the formats object
    const attachmentId = options.attachId ? options.attachId : formats.attachId

    if (!options.proposalAttachment) {
      throw new AriesFrameworkError('create JsonLd offer: missing proposal attachment')
    }

    const credPropose = options.proposalAttachment.getDataAsJson<W3cCredential>()

    const offersAttach: Attachment = this.getFormatData(credPropose, attachmentId)

    return { format: formats, attachment: offersAttach }
  }

  public async createRequest(
    options: FormatServiceRequestCredentialOptions,
    credentialRecord: CredentialExchangeRecord,
    holderDid?: string
  ): Promise<FormatServiceCredentialAttachmentFormats> {
    if (!options.offerAttachment) {
      throw new AriesFrameworkError(
        `Missing attachment from offer message, credential record id = ${credentialRecord.id}`
      )
    }
    const formats: CredentialFormatSpec = {
      attachId: uuid(),
      format: 'aries/ld-proof-vc-detail@v1.0',
    }

    // W3C message exchange can begin with request or there could be an offer.
    // Use offer attachment as the credential if present
    // otherwise use the credential format payload passed in the options object

    const credOffer = options.offerAttachment.getDataAsJson<W3cCredential>()
    const attachment = credOffer ? credOffer : options.jsonld?.credentialSubject

    const requestAttach: Attachment = this.getFormatData(attachment, formats.attachId)

    return { format: formats, attachment: requestAttach }
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

  private arePreviousCredentialsEqual(
    request: AttachmentData,
    proposal?: AttachmentData,
    offer?: AttachmentData
  ): boolean {
    if (!request) {
      return false
    }
    if (proposal || offer) {
      const previousCredential = offer ? offer : proposal

      if (previousCredential) {
        if (this.areCredentialsEqual(previousCredential, request)) {
          return true
        }
        return true
      }
    }
    return false
  }

  shouldAutoRespondToRequest(options: HandlerAutoAcceptOptions): boolean {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      options.credentialRecord.autoAcceptCredential,
      options.autoAcceptType
    )

    if (!options.requestAttachment) {
      throw new AriesFrameworkError(`Missing Request Attachment for Credential Record ${options.credentialRecord.id}`)
    }
    if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return this.arePreviousCredentialsEqual(
        options.requestAttachment.data,
        options.offerAttachment?.data,
        options.proposalAttachment?.data
      )
    }
    return false
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
