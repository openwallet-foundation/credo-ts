import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Attachment } from '../../../decorators/attachment/Attachment'
import type { DidCommMessageRepository } from '../../../storage'
import type {
  RetrivedCredentialOptions,
  ProofRequestFormats,
  RequestedCredentialsFormats,
} from '../models/SharedOptions'
import type { IndyGetRequestedCredentialsFormat } from './IndyProofFormatsServiceOptions'
import type { ProofAttachmentFormat } from './models/ProofAttachmentFormat'
import type {
  CreatePresentationOptions,
  CreateProposalOptions,
  CreateRequestOptions,
  ProcessPresentationOptions,
} from './models/ProofFormatServiceOptions'

/**
 * This abstract class is the base class for any proof format
 * specific service.
 *
 * @export
 * @abstract
 * @class ProofFormatService
 */
export abstract class ProofFormatService {
  protected didCommMessageRepository: DidCommMessageRepository
  protected agentConfig: AgentConfig

  public constructor(didCommMessageRepository: DidCommMessageRepository, agentConfig: AgentConfig) {
    this.didCommMessageRepository = didCommMessageRepository
    this.agentConfig = agentConfig
  }

  abstract createProposal(options: CreateProposalOptions): Promise<ProofAttachmentFormat>

  abstract createRequest(options: CreateRequestOptions): Promise<ProofAttachmentFormat>

  abstract createPresentation(options: CreatePresentationOptions): Promise<ProofAttachmentFormat>

  abstract processPresentation(options: ProcessPresentationOptions): Promise<boolean>

  abstract createProofRequestFromProposal(options: {
    formats: {
      indy?: {
        presentationProposal: Attachment
      }
      jsonLd?: never
    }
    config?: { indy?: { name: string; version: string; nonce?: string }; jsonLd?: never }
  }): Promise<ProofRequestFormats>

  public abstract getRequestedCredentialsForProofRequest(
    options: IndyGetRequestedCredentialsFormat
  ): Promise<RetrivedCredentialOptions>

  public abstract autoSelectCredentialsForProofRequest(
    options: RetrivedCredentialOptions
  ): Promise<RequestedCredentialsFormats>

  abstract proposalAndRequestAreEqual(
    proposalAttachments: ProofAttachmentFormat[],
    requestAttachments: ProofAttachmentFormat[]
  ): boolean

  abstract supportsFormat(formatIdentifier: string): boolean
}
