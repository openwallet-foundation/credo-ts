import type { AgentContext } from '@credo-ts/core'
import type { DidCommCredentialFormat } from './DidCommCredentialFormat'
import type {
  DidCommCredentialFormatAcceptOfferOptions,
  DidCommCredentialFormatAcceptProposalOptions,
  DidCommCredentialFormatAcceptRequestOptions,
  DidCommCredentialFormatAutoRespondCredentialOptions,
  DidCommCredentialFormatAutoRespondOfferOptions,
  DidCommCredentialFormatAutoRespondProposalOptions,
  DidCommCredentialFormatAutoRespondRequestOptions,
  DidCommCredentialFormatCreateOfferOptions,
  DidCommCredentialFormatCreateOfferReturn,
  DidCommCredentialFormatCreateProposalOptions,
  DidCommCredentialFormatCreateProposalReturn,
  DidCommCredentialFormatCreateRequestOptions,
  DidCommCredentialFormatCreateReturn,
  DidCommCredentialFormatProcessCredentialOptions,
  DidCommCredentialFormatProcessOptions,
} from './DidCommCredentialFormatServiceOptions'

export interface DidCommCredentialFormatService<CF extends DidCommCredentialFormat = DidCommCredentialFormat> {
  formatKey: CF['formatKey']
  credentialRecordType: CF['credentialRecordType']

  // proposal methods
  createProposal(
    agentContext: AgentContext,
    options: DidCommCredentialFormatCreateProposalOptions<CF>
  ): Promise<DidCommCredentialFormatCreateProposalReturn>
  processProposal(agentContext: AgentContext, options: DidCommCredentialFormatProcessOptions): Promise<void>
  acceptProposal(
    agentContext: AgentContext,
    options: DidCommCredentialFormatAcceptProposalOptions<CF>
  ): Promise<DidCommCredentialFormatCreateOfferReturn>

  // offer methods
  createOffer(
    agentContext: AgentContext,
    options: DidCommCredentialFormatCreateOfferOptions<CF>
  ): Promise<DidCommCredentialFormatCreateOfferReturn>
  processOffer(agentContext: AgentContext, options: DidCommCredentialFormatProcessOptions): Promise<void>
  acceptOffer(
    agentContext: AgentContext,
    options: DidCommCredentialFormatAcceptOfferOptions<CF>
  ): Promise<DidCommCredentialFormatCreateReturn>

  // request methods
  createRequest(
    agentContext: AgentContext,
    options: DidCommCredentialFormatCreateRequestOptions<CF>
  ): Promise<DidCommCredentialFormatCreateReturn>
  processRequest(agentContext: AgentContext, options: DidCommCredentialFormatProcessOptions): Promise<void>
  acceptRequest(
    agentContext: AgentContext,
    options: DidCommCredentialFormatAcceptRequestOptions<CF>
  ): Promise<DidCommCredentialFormatCreateReturn>

  // credential methods
  processCredential(agentContext: AgentContext, options: DidCommCredentialFormatProcessCredentialOptions): Promise<void>

  // auto accept methods
  shouldAutoRespondToProposal(
    agentContext: AgentContext,
    options: DidCommCredentialFormatAutoRespondProposalOptions
  ): Promise<boolean>
  shouldAutoRespondToOffer(
    agentContext: AgentContext,
    options: DidCommCredentialFormatAutoRespondOfferOptions
  ): Promise<boolean>
  shouldAutoRespondToRequest(
    agentContext: AgentContext,
    options: DidCommCredentialFormatAutoRespondRequestOptions
  ): Promise<boolean>
  shouldAutoRespondToCredential(
    agentContext: AgentContext,
    options: DidCommCredentialFormatAutoRespondCredentialOptions
  ): Promise<boolean>

  deleteCredentialById(agentContext: AgentContext, credentialId: string): Promise<void>

  supportsFormat(formatIdentifier: string): boolean
}
