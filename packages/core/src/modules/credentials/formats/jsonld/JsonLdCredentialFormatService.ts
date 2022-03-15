/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/adjacent-overload-signatures */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { AgentMessage } from '../../../../../src/agent/AgentMessage'
import type { EventEmitter } from '../../../../agent/EventEmitter'
import type { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import type { ConnectionService } from '../../../connections/services/ConnectionService'
import type { IndyHolderService } from '../../../indy/services/IndyHolderService'
import type { IndyIssuerService } from '../../../indy/services/IndyIssuerService'
import type { IndyLedgerService } from '../../../ledger/services/IndyLedgerService'
import type { ServiceAcceptOfferOptions } from '../../CredentialServiceOptions'
import type {
  AcceptCredentialOptions,
  AcceptProposalOptions,
  AcceptRequestOptions,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../../interfaces'
import type { CredentialExchangeRecord } from '../../repository/CredentialRecord'
import type { CredentialRepository } from '../../repository/CredentialRepository'
import type {
  CredentialAttachmentFormats,
  CredentialFormatSpec,
  HandlerAutoAcceptOptions,
  OfferAttachmentFormats,
} from '../models/CredentialFormatServiceOptions'
import type { CredOffer } from 'indy-sdk'

import { AriesFrameworkError } from '../../../../../src/error'
import { uuid } from '../../../../../src/utils/uuid'
import { AutoAcceptCredential } from '../../CredentialAutoAcceptType'
import { CredentialResponseCoordinator } from '../../CredentialResponseCoordinator'
import { CredentialFormatService } from '../CredentialFormatService'

export class JsonLdCredentialFormatService extends CredentialFormatService {
  private indyIssuerService: IndyIssuerService
  private indyLedgerService: IndyLedgerService
  private indyHolderService: IndyHolderService
  private connectionService: ConnectionService
  protected credentialRepository: CredentialRepository // protected as in base class

  public constructor(
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    indyIssuerService: IndyIssuerService,
    indyLedgerService: IndyLedgerService,
    indyHolderService: IndyHolderService,
    connectionService: ConnectionService
  ) {
    super(credentialRepository, eventEmitter)
    this.credentialRepository = credentialRepository
    this.indyIssuerService = indyIssuerService // temporaary until the new w3ccredentialservice is avaialable
    this.indyLedgerService = indyLedgerService
    this.indyHolderService = indyHolderService
    this.connectionService = connectionService
  }
  public async processProposal(
    options: AcceptProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<AcceptProposalOptions> {
    // no meta data set for ld proofs
    return options
  }

  public async createOffer(options: ServiceAcceptOfferOptions): Promise<OfferAttachmentFormats> {
    const formats: CredentialFormatSpec = {
      attachId: uuid(),
      format: 'aries/ld-proof-vc-detail@v1.0',
    }
    const offer = await this.createCredentialOffer(options)

    // if the proposal has an attachment Id use that, otherwise the generated id of the formats object
    const attachmentId = options.attachId ? options.attachId : formats.attachId

    const offersAttach: Attachment = this.getFormatData(offer, attachmentId)

    return { format: formats, attachment: offersAttach }
  }

  /**
   * Create a credential offer for the given credential definition id.
   *
   * @param credentialDefinitionId The credential definition to create an offer for
   * @returns The created credential offer
   */
  private async createCredentialOffer(
    options: ServiceAcceptOfferOptions | NegotiateProposalOptions | OfferCredentialOptions
  ): Promise<CredOffer> {
    if (!options.credentialFormats.jsonld) {
      throw new AriesFrameworkError('Missing jsonld credential format in createCredentialOffer')
    }
    const credOffer: CredOffer = await this.indyIssuerService.createCredentialOffer(
      options.credentialFormats.jsonld?.credentialDefinitionId
    )
    return credOffer
  }
  createRequest(
    options: RequestCredentialOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialAttachmentFormats> {
    throw new Error('Method not implemented.')
  }
  createCredential(
    options: AcceptRequestOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialAttachmentFormats> {
    throw new Error('Method not implemented.')
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
  processOffer(options: AcceptProposalOptions, credentialRecord: CredentialExchangeRecord): void {
    // empty: no metadata set for offer
  }
  processCredential(options: AcceptCredentialOptions, credentialRecord: CredentialExchangeRecord): Promise<void> {
    throw new Error('Method not implemented.')
  }
  processRequest(options: RequestCredentialOptions, credentialRecord: CredentialExchangeRecord): void {
    throw new Error('Method not implemented.')
  }

  public createProposal(options: ProposeCredentialOptions): CredentialAttachmentFormats {
    const format: CredentialFormatSpec = {
      attachId: 'ld_proof',
      format: 'aries/ld-proof-vc-detail@v1.0',
    }

    const attachment: Attachment = this.getFormatData(options.credentialFormats.jsonld, format.attachId)

    // For now we will not handle linked attachments in the W3C credential. So the credentialProposal array
    // should just contain standard crede

    return { format, attachment }
  }
}
