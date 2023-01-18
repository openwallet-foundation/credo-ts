import type { ProofFormat } from './ProofFormat'
import type { IndyProofFormat } from './indy/IndyProofFormat'
import type { GetRequestedCredentialsFormat } from './indy/IndyProofFormatsServiceOptions'
import type { ProofAttachmentFormat } from './models/ProofAttachmentFormat'
import type {
  CreatePresentationFormatsOptions,
  FormatCreateProofProposalOptions,
  CreateRequestOptions,
  FormatCreatePresentationOptions,
  ProcessPresentationOptions,
  ProcessProposalOptions,
  ProcessRequestOptions,
} from './models/ProofFormatServiceOptions'
import type { AgentContext } from '../../../agent'
import type { AgentConfig } from '../../../agent/AgentConfig'
import type { DidCommMessageRepository } from '../../../storage'
import type {
  CreateRequestAsResponseOptions,
  FormatRequestedCredentialReturn,
  FormatRetrievedCredentialOptions,
} from '../models/ProofServiceOptions'
import type { ProofRequestFormats } from '../models/SharedOptions'

/**
 * This abstract class is the base class for any proof format
 * specific service.
 *
 * @export
 * @abstract
 * @class ProofFormatService
 */
export abstract class ProofFormatService<PF extends ProofFormat = ProofFormat> {
  protected didCommMessageRepository: DidCommMessageRepository
  protected agentConfig: AgentConfig

  public abstract readonly formatKey: PF['formatKey']

  public constructor(didCommMessageRepository: DidCommMessageRepository, agentConfig: AgentConfig) {
    this.didCommMessageRepository = didCommMessageRepository
    this.agentConfig = agentConfig
  }

  public abstract createProposal(options: FormatCreateProofProposalOptions): Promise<ProofAttachmentFormat>

  public abstract processProposal(options: ProcessProposalOptions): Promise<void>

  public abstract createRequest(options: CreateRequestOptions): Promise<ProofAttachmentFormat>

  public abstract processRequest(options: ProcessRequestOptions): Promise<void>

  public abstract createPresentation(
    agentContext: AgentContext,
    options: FormatCreatePresentationOptions<PF>
  ): Promise<ProofAttachmentFormat>

  public abstract processPresentation(agentContext: AgentContext, options: ProcessPresentationOptions): Promise<boolean>

  public abstract createProofRequestFromProposal(
    options: CreatePresentationFormatsOptions
  ): Promise<ProofRequestFormats>

  public abstract getRequestedCredentialsForProofRequest(
    agentContext: AgentContext,
    options: GetRequestedCredentialsFormat
  ): Promise<FormatRetrievedCredentialOptions<[PF]>>

  public abstract autoSelectCredentialsForProofRequest(
    options: FormatRetrievedCredentialOptions<[PF]>
  ): Promise<FormatRequestedCredentialReturn<[PF]>>

  public abstract proposalAndRequestAreEqual(
    proposalAttachments: ProofAttachmentFormat[],
    requestAttachments: ProofAttachmentFormat[]
  ): boolean

  public abstract supportsFormat(formatIdentifier: string): boolean

  public abstract createRequestAsResponse(
    options: CreateRequestAsResponseOptions<[IndyProofFormat]>
  ): Promise<ProofAttachmentFormat>
}
