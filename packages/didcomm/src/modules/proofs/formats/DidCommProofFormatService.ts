import type { AgentContext } from '@credo-ts/core'
import type { DidCommProofFormat } from './DidCommProofFormat'
import type {
  DidCommFormatCreateRequestOptions,
  DidCommProofFormatAcceptProposalOptions,
  DidCommProofFormatAcceptRequestOptions,
  DidCommProofFormatAutoRespondPresentationOptions,
  DidCommProofFormatAutoRespondProposalOptions,
  DidCommProofFormatAutoRespondRequestOptions,
  DidCommProofFormatCreateProposalOptions,
  DidCommProofFormatCreateReturn,
  DidCommProofFormatGetCredentialsForRequestOptions,
  DidCommProofFormatGetCredentialsForRequestReturn,
  DidCommProofFormatProcessOptions,
  DidCommProofFormatProcessPresentationOptions,
  DidCommProofFormatSelectCredentialsForRequestOptions,
  DidCommProofFormatSelectCredentialsForRequestReturn,
} from './DidCommProofFormatServiceOptions'

export interface DidCommProofFormatService<PF extends DidCommProofFormat = DidCommProofFormat> {
  formatKey: PF['formatKey']

  // proposal methods
  createProposal(
    agentContext: AgentContext,
    options: DidCommProofFormatCreateProposalOptions<PF>
  ): Promise<DidCommProofFormatCreateReturn>
  processProposal(agentContext: AgentContext, options: DidCommProofFormatProcessOptions): Promise<void>
  acceptProposal(
    agentContext: AgentContext,
    options: DidCommProofFormatAcceptProposalOptions<PF>
  ): Promise<DidCommProofFormatCreateReturn>

  // request methods
  createRequest(
    agentContext: AgentContext,
    options: DidCommFormatCreateRequestOptions<PF>
  ): Promise<DidCommProofFormatCreateReturn>
  processRequest(agentContext: AgentContext, options: DidCommProofFormatProcessOptions): Promise<void>
  acceptRequest(
    agentContext: AgentContext,
    options: DidCommProofFormatAcceptRequestOptions<PF>
  ): Promise<DidCommProofFormatCreateReturn>

  // presentation methods
  processPresentation(
    agentContext: AgentContext,
    options: DidCommProofFormatProcessPresentationOptions
  ): Promise<boolean>

  // credentials for request
  getCredentialsForRequest(
    agentContext: AgentContext,
    options: DidCommProofFormatGetCredentialsForRequestOptions<PF>
  ): Promise<DidCommProofFormatGetCredentialsForRequestReturn<PF>>
  selectCredentialsForRequest(
    agentContext: AgentContext,
    options: DidCommProofFormatSelectCredentialsForRequestOptions<PF>
  ): Promise<DidCommProofFormatSelectCredentialsForRequestReturn<PF>>

  // auto accept methods
  shouldAutoRespondToProposal(
    agentContext: AgentContext,
    options: DidCommProofFormatAutoRespondProposalOptions
  ): Promise<boolean>
  shouldAutoRespondToRequest(
    agentContext: AgentContext,
    options: DidCommProofFormatAutoRespondRequestOptions
  ): Promise<boolean>
  shouldAutoRespondToPresentation(
    agentContext: AgentContext,
    options: DidCommProofFormatAutoRespondPresentationOptions
  ): Promise<boolean>

  supportsFormat(formatIdentifier: string): boolean
}
