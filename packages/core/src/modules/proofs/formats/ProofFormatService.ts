import type { AgentContext } from '../../../agent'
import type {
  RetrievedCredentialOptions,
  ProofRequestFormats,
  RequestedCredentialsFormats,
} from '../models/SharedOptions'
import type { CreateRequestAsResponseOptions, GetRequestedCredentialsFormat } from './IndyProofFormatsServiceOptions'
import type { ProofFormat } from './ProofFormat'
import type {
  FormatCreateReturn,
  FormatProcessOptions,
  FormatCreateProposalOptions,
  FormatAcceptProposalOptions,
} from './ProofFormatServiceOptions'
import type { ProofAttachmentFormat } from './models/ProofAttachmentFormat'
import { CreateRequestOptions, CreatePresentationOptions } from '../models/ProofServiceOptions'
import {
  ProcessRequestOptions,
  ProcessPresentationOptions,
  CreatePresentationFormatsOptions,
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
  abstract readonly formatKey: PF['formatKey']

  // proposal methods
  abstract createProposal(
    agentContext: AgentContext,
    options: FormatCreateProposalOptions<PF>
  ): Promise<FormatCreateReturn>
  abstract processProposal(agentContext: AgentContext, options: FormatProcessOptions): Promise<void>
  abstract acceptProposal(
    agentContext: AgentContext,
    options: FormatAcceptProposalOptions<PF>
  ): Promise<FormatCreateReturn>

  abstract createRequest(options: CreateRequestOptions): Promise<ProofAttachmentFormat>

  abstract processRequest(options: ProcessRequestOptions): Promise<void>

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
