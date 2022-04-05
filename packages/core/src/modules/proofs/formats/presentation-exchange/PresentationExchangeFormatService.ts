import type {
  AutoSelectCredentialOptions,
  ProofRequestFormats,
  RequestedCredentialsFormats,
} from '../../models/SharedOptions'
import type { IndyGetRequestedCredentialsFormat } from '../IndyProofFormatsServiceOptions'
import type { ProofAttachmentFormat } from '../models/ProofAttachmentFormat'
import type {
  CreatePresentationExchangeProposalAttachmentOptions,
  CreatePresentationOptions,
  CreateProposalOptions,
  CreateRequestOptions,
  ProcessPresentationOptions,
} from '../models/ProofFormatServiceOptions'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../../agent/AgentConfig'
import { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import { DidCommMessageRepository } from '../../../../storage/didcomm/DidCommMessageRepository'
import { uuid } from '../../../../utils/uuid'
import { IndyHolderService, IndyVerifierService, IndyRevocationService } from '../../../indy'
import { IndyLedgerService } from '../../../ledger'
import { ProofFormatService } from '../ProofFormatService'
import { ProofFormatSpec } from '../models/ProofFormatSpec'

@scoped(Lifecycle.ContainerScoped)
export class PresentationExchangeFormatService extends ProofFormatService {
  private indyHolderService: IndyHolderService
  private indyVerifierService: IndyVerifierService
  private indyRevocationService: IndyRevocationService
  private ledgerService: IndyLedgerService

  public constructor(
    agentConfig: AgentConfig,
    indyHolderService: IndyHolderService,
    indyVerifierService: IndyVerifierService,
    indyRevocationService: IndyRevocationService,
    ledgerService: IndyLedgerService,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    super(didCommMessageRepository, agentConfig)
    this.indyHolderService = indyHolderService
    this.indyVerifierService = indyVerifierService
    this.indyRevocationService = indyRevocationService
    this.ledgerService = ledgerService
  }

  private createProofAttachment(options: CreatePresentationExchangeProposalAttachmentOptions): ProofAttachmentFormat {
    const format = new ProofFormatSpec({
      attachmentId: options.attachId,
      format: 'dif/presentation-exchange/definition@v1.0',
    })

    const attachment = new Attachment({
      id: options.attachId,
      mimeType: 'application/json',
      data: new AttachmentData({
        json: { inputDescriptors: options.proofProposalOptions },
      }),
    })

    return { format, attachment }
  }

  public createProposal(options: CreateProposalOptions): ProofAttachmentFormat {
    if (!options.formats.presentationExchange) {
      throw Error('Presentation Exchange format missing')
    }

    if (!options.formats.presentationExchange.inputDescriptors) {
      throw Error('Input Descriptor missing')
    }

    return this.createProofAttachment({
      attachId: options.attachId ?? uuid(),
      proofProposalOptions: options.formats.presentationExchange.inputDescriptors,
    })
  }

  public createRequest(options: CreateRequestOptions): ProofAttachmentFormat {
    throw new Error('Method not implemented.')
  }

  public createPresentation(options: CreatePresentationOptions): Promise<ProofAttachmentFormat> {
    throw new Error('Method not implemented.')
  }

  public processPresentation(options: ProcessPresentationOptions): Promise<boolean> {
    throw new Error('Method not implemented.')
  }

  public createProofRequestFromProposal(options: {
    formats: { indy?: { presentationProposal: Attachment } | undefined; jsonLd?: undefined }
    config?:
    | { indy?: { name: string; version: string; nonce?: string | undefined } | undefined; jsonLd?: undefined }
    | undefined
  }): Promise<ProofRequestFormats> {
    throw new Error('Method not implemented.')
  }

  public getRequestedCredentialsForProofRequest(
    options: IndyGetRequestedCredentialsFormat
  ): Promise<AutoSelectCredentialOptions> {
    throw new Error('Method not implemented.')
  }
  
  public autoSelectCredentialsForProofRequest(
    options: AutoSelectCredentialOptions
  ): Promise<RequestedCredentialsFormats> {
    throw new Error('Method not implemented.')
  }
  
  public proposalAndRequestAreEqual(
    proposalAttachments: ProofAttachmentFormat[],
    requestAttachments: ProofAttachmentFormat[]
  ): boolean {
    throw new Error('Method not implemented.')
  }

  public supportsFormat(formatIdentifier: string): boolean {
    throw new Error('Method not implemented.')
  }
}
