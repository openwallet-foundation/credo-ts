import type { AgentContext } from '../../../agent'
import type { AgentConfig } from '../../../agent/AgentConfig'
import type { DidCommMessageRepository } from '../../../storage'
import type {
  CreateProposalAsResponseOptions,
  CreateProposalOptions,
  CreateRequestAsResponseOptions,
  FormatRequestedCredentialReturn,
  FormatRetrievedCredentialOptions,
} from '../models/ProofServiceOptions'
import type { ProofRequestFormats } from '../models/SharedOptions'
import type { ProofFormat } from './ProofFormat'
import type { GetRequestedCredentialsFormat } from './indy/IndyProofFormatsServiceOptions'
import type { ProofAttachmentFormat } from './models/ProofAttachmentFormat'
import type {
  FormatCreatePresentationFormatsOptions,
  FormatCreateProposalOptions,
  FormatCreateRequestOptions,
  FormatCreatePresentationOptions,
  FormatProcessPresentationOptions,
  FormatProcessProposalOptions,
  FormatProcessRequestOptions,
} from './models/ProofFormatServiceOptions'

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

  abstract readonly formatKey: PF['formatKey']

  public constructor(didCommMessageRepository: DidCommMessageRepository, agentConfig: AgentConfig) {
    this.didCommMessageRepository = didCommMessageRepository
    this.agentConfig = agentConfig
  }

  abstract createProposal(options: FormatCreateProposalOptions<PF>): Promise<ProofAttachmentFormat>

  abstract processProposal(options: FormatProcessProposalOptions): Promise<void>

  abstract createRequest(options: FormatCreateRequestOptions): Promise<ProofAttachmentFormat>

  abstract processRequest(options: FormatProcessRequestOptions<PF>): Promise<void>

  abstract createPresentation(
    agentContext: AgentContext,
    options: FormatCreatePresentationOptions<PF>
  ): Promise<ProofAttachmentFormat>

  abstract processPresentation(agentContext: AgentContext, options: FormatProcessPresentationOptions): Promise<boolean>

  abstract createProofRequestFromProposal(options: FormatCreatePresentationFormatsOptions): Promise<ProofRequestFormats>

  public abstract getRequestedCredentialsForProofRequest(
    agentContext: AgentContext,
    options: GetRequestedCredentialsFormat
  ): Promise<FormatRetrievedCredentialOptions<[PF]>>

  public abstract autoSelectCredentialsForProofRequest(
    options: FormatRetrievedCredentialOptions<[PF]>
  ): Promise<FormatRequestedCredentialReturn<[PF]>>

  abstract proposalAndRequestAreEqual(
    proposalAttachments: ProofAttachmentFormat[],
    requestAttachments: ProofAttachmentFormat[]
  ): boolean

  abstract getProposalFormatOptions(
    options: CreateProposalOptions<[PF]> | CreateProposalAsResponseOptions<[PF]>
  ): Promise<FormatCreateProposalOptions<PF>>

  abstract supportsFormat(formatIdentifier: string): boolean

  abstract createRequestAsResponse(options: CreateRequestAsResponseOptions<[PF]>): Promise<ProofAttachmentFormat>

  abstract createProcessRequestOptions(request: ProofAttachmentFormat): FormatProcessRequestOptions<PF>
}
