import type { AgentConfig } from '../../../agent/AgentConfig'
import type { DidCommMessageRepository } from '../../../storage'
import type {
  RetrievedCredentialOptions,
  ProofRequestFormats,
  RequestedCredentialsFormats,
} from '../models/SharedOptions'
import type { CreateRequestAsResponseOptions, GetRequestedCredentialsFormat } from './IndyProofFormatsServiceOptions'
import type { ProofAttachmentFormat } from './models/ProofAttachmentFormat'
import type {
  CreatePresentationFormatsOptions,
  CreatePresentationOptions,
  CreateProposalOptions,
  CreateRequestOptions,
  ProcessPresentationOptions,
  ProcessProposalOptions,
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

  abstract processProposal(options: ProcessProposalOptions): void

  abstract createRequest(options: CreateRequestOptions): Promise<ProofAttachmentFormat>

  abstract createPresentation(options: CreatePresentationOptions): Promise<ProofAttachmentFormat>

  abstract processPresentation(options: ProcessPresentationOptions): Promise<boolean>

  abstract createProofRequestFromProposal(options: CreatePresentationFormatsOptions): Promise<ProofRequestFormats>

  public abstract getRequestedCredentialsForProofRequest(
    options: GetRequestedCredentialsFormat
  ): Promise<RetrievedCredentialOptions>

  public abstract autoSelectCredentialsForProofRequest(
    options: RetrievedCredentialOptions
  ): Promise<RequestedCredentialsFormats>

  abstract proposalAndRequestAreEqual(
    proposalAttachments: ProofAttachmentFormat[],
    requestAttachments: ProofAttachmentFormat[]
  ): boolean

  abstract supportsFormat(formatIdentifier: string): boolean

  abstract createRequestAsResponse(options: CreateRequestAsResponseOptions): Promise<ProofAttachmentFormat>
}
