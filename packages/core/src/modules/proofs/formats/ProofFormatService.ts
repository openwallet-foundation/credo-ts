import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Attachment } from '../../../decorators/attachment/Attachment'
import type { DidCommMessageRepository } from '../../../storage'
import type { GetRequestedCredentialsConfig } from '../models/GetRequestedCredentialsConfig'
import type { PresentationPreview } from '../protocol/v1/models/PresentationPreview'
import type { ProofRequest } from './indy/models/ProofRequest'
import type { RequestedCredentials } from './indy/models/RequestedCredentials'
import type { RetrievedCredentials } from './indy/models/RetrievedCredentials'
import type { ProofAttachmentFormat } from './models/ProofAttachmentFormat'
import type {
  CreatePresentationOptions,
  CreateProposalOptions,
  CreateRequestOptions,
  ProcessPresentationOptions,
  ProcessProposalOptions,
  ProcessRequestOptions,
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

  abstract createProposal(options: CreateProposalOptions): ProofAttachmentFormat

  abstract processProposal(options: ProcessProposalOptions): void

  abstract createRequest(options: CreateRequestOptions): ProofAttachmentFormat

  abstract processRequest(options: ProcessRequestOptions): void

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
  }): Promise<{
    indy?: ProofRequest
    jsonLd?: never
  }>

  public abstract getRequestedCredentialsForProofRequest(options: {
    proofRequest: ProofRequest
    presentationProposal?: PresentationPreview
    config: {
      indy?: GetRequestedCredentialsConfig
      jsonLd?: never
    }
  }): Promise<{
    indy?: RetrievedCredentials
    jsonLd?: never
  }>

  public abstract autoSelectCredentialsForProofRequest(options: {
    indy?: RetrievedCredentials
    jsonLd?: never
  }): Promise<{
    indy?: RequestedCredentials
    jsonLd?: never
  }>

  abstract proposalAndRequestAreEqual(
    proposalAttachments: ProofAttachmentFormat[],
    requestAttachments: ProofAttachmentFormat[]
  ): boolean

  abstract supportsFormat(formatIdentifier: string): boolean

  // abstract getRequestedCredentialsForProofRequest(record: ProofRecord):
}
