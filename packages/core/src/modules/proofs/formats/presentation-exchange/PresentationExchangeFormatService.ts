import type {
  AutoSelectCredentialOptions,
  ProofRequestFormats,
  RequestedCredentialsFormats,
} from '../../models/SharedOptions'
import type { IndyGetRequestedCredentialsFormat } from '../IndyProofFormatsServiceOptions'
import type { ProofAttachmentFormat } from '../models/ProofAttachmentFormat'
import type {
  CreatePresentationFormatsOptions,
  CreatePresentationOptions,
  CreateProposalOptions,
  CreateRequestAsResponseOptions,
  CreateRequestOptions,
  ProcessPresentationOptions,
  ProcessProposalOptions,
} from '../models/ProofFormatServiceOptions'
import type { InputDescriptorsSchemaOptions } from './models'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../../agent/AgentConfig'
import { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import { DidCommMessageRepository } from '../../../../storage/didcomm/DidCommMessageRepository'
import { uuid } from '../../../../utils/uuid'
import { IndyHolderService, IndyVerifierService, IndyRevocationService } from '../../../indy'
import { IndyLedgerService } from '../../../ledger'
import { ProofFormatService } from '../ProofFormatService'
import { ATTACHMENT_FORMAT } from '../ProofFormats'
import { ProofFormatSpec } from '../models/ProofFormatSpec'

import { InputDescriptorsSchema } from './models'
import { PresentationDefinition, RequestPresentation } from './models/RequestPresentation'

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

  public async createProofRequestFromProposal(options: CreatePresentationFormatsOptions): Promise<ProofRequestFormats> {
    const inputDescriptorsJson = options.presentationAttachment.getDataAsJson<InputDescriptorsSchema>() ?? null

    const presentationDefinition: PresentationDefinition = new PresentationDefinition({
      inputDescriptors: inputDescriptorsJson['input_descriptors'],
      format: {
        ldpVc: {
          proofType: ['Ed25519Signature2018'],
        },
      },
    })

    const presentationExchangeRequestMessage: RequestPresentation = new RequestPresentation({
      options: {
        challenge: '',
        domain: '',
      },
      presentationDefinition: presentationDefinition,
    })

    return {
      presentationExchange: presentationExchangeRequestMessage,
    }
  }

  public createProposal(options: CreateProposalOptions): Promise<ProofAttachmentFormat> {
    throw new Error('Method not implemented.')
  }

  public processProposal(options: ProcessProposalOptions): void {
    throw new Error('Method not implemented.')
  }

  public async createRequest(options: CreateRequestOptions): Promise<ProofAttachmentFormat> {
    if (!options.formats.presentationExchange) {
      throw Error('Presentation Exchange format missing')
    }

    if (!options.formats.presentationExchange.inputDescriptors) {
      throw Error('Input Descriptor missing')
    }

    const inputDescriptorsSchemaOptions: InputDescriptorsSchemaOptions = {
      inputDescriptors: options.formats.presentationExchange.inputDescriptors,
    }

    const proposalInputDescriptor = new InputDescriptorsSchema(inputDescriptorsSchemaOptions)
    const attachId = options.attachId ?? uuid()

    const format = new ProofFormatSpec({
      attachmentId: attachId,
      format: ATTACHMENT_FORMAT.V2_PRESENTATION_REQUEST.ldproof.format,
    })

    const attachment = new Attachment({
      id: attachId,
      mimeType: 'application/json',
      data: new AttachmentData({
        json: proposalInputDescriptor.toJSON(),
      }),
    })

    return { format, attachment }
  }

  public async createRequestAsResponse(options: CreateRequestAsResponseOptions): Promise<ProofAttachmentFormat> {
    if (!options.formats.presentationExchange) {
      throw Error('Presentation Exchange format missing')
    }

    if (!options.formats.presentationExchange) {
      throw Error('Input Descriptor missing')
    }

    const presentationExchangeRequestMessage: RequestPresentation = new RequestPresentation({
      options: options.formats.presentationExchange.options,
      presentationDefinition: options.formats.presentationExchange.presentationDefinition,
    })

    const attachId = options.attachId ?? uuid()

    const format = new ProofFormatSpec({
      attachmentId: attachId,
      format: ATTACHMENT_FORMAT.V2_PRESENTATION_REQUEST.ldproof.format,
    })

    const attachment = new Attachment({
      id: attachId,
      mimeType: 'application/json',
      data: new AttachmentData({
        json: presentationExchangeRequestMessage.toJSON(),
      }),
    })

    return { format, attachment }
  }

  public createPresentation(options: CreatePresentationOptions): Promise<ProofAttachmentFormat> {
    throw new Error('Method not implemented.')
  }

  public processPresentation(options: ProcessPresentationOptions): Promise<boolean> {
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
    const supportedFormats = [
      ATTACHMENT_FORMAT.V2_PRESENTATION_PROPOSAL.ldproof.format,
      ATTACHMENT_FORMAT.V2_PRESENTATION_REQUEST.ldproof.format,
      ATTACHMENT_FORMAT.V2_PRESENTATION.ldproof.format,
    ]
    return supportedFormats.includes(formatIdentifier)
  }
}
