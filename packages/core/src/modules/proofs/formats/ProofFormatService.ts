import type { AgentContext } from '../../../agent'
import type { AgentConfig } from '../../../agent/AgentConfig'
import type { DidCommMessageRepository } from '../../../storage'
import type {
  CreateRequestAsResponseOptions,
  FormatRequestedCredentialReturn,
  FormatRetrievedCredentialOptions,
} from '../models/ProofServiceOptions'
import type { ProofRequestFormats } from '../models/SharedOptions'
import type { ProofFormat } from './ProofFormat'
import type { IndyProofFormat } from './indy/IndyProofFormat'
import type { GetRequestedCredentialsFormat } from './indy/IndyProofFormatsServiceOptions'
import type { ProofAttachmentFormat } from './models/ProofAttachmentFormat'
import type {
  CreatePresentationFormatsOptions,
  CreateProposalOptions,
  CreateRequestOptions,
  FormatCreatePresentationOptions,
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
export abstract class ProofFormatService<PF extends ProofFormat = ProofFormat> {
  protected didCommMessageRepository: DidCommMessageRepository
  protected agentConfig: AgentConfig

  abstract readonly formatKey: PF['formatKey']
  abstract readonly proofRecordType: PF['proofRecordType']

  public constructor(didCommMessageRepository: DidCommMessageRepository, agentConfig: AgentConfig) {
    this.didCommMessageRepository = didCommMessageRepository
    this.agentConfig = agentConfig
  }

  abstract createProposal(options: CreateProposalOptions): Promise<ProofAttachmentFormat>

  abstract processProposal(options: ProcessProposalOptions): Promise<void>

  abstract createRequest(options: CreateRequestOptions): Promise<ProofAttachmentFormat>

  abstract processRequest(options: ProcessRequestOptions): Promise<void>

  abstract createPresentation(
    agentContext: AgentContext,
    options: FormatCreatePresentationOptions<PF>
  ): Promise<ProofAttachmentFormat>

  abstract processPresentation(agentContext: AgentContext, options: ProcessPresentationOptions): Promise<boolean>

  abstract createProofRequestFromProposal(options: CreatePresentationFormatsOptions): Promise<ProofRequestFormats>

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

  abstract supportsFormat(formatIdentifier: string): boolean

  abstract createRequestAsResponse(
    options: CreateRequestAsResponseOptions<[IndyProofFormat]>
  ): Promise<ProofAttachmentFormat>
}
