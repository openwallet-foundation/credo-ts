import type { AgentContext } from '../../../agent'
import type { V1Attachment } from '../../../decorators/attachment/V1Attachment'
import type { CredentialFormat } from './CredentialFormat'
import type {
  FormatCreateProposalOptions,
  FormatCreateProposalReturn,
  FormatProcessOptions,
  FormatCreateOfferOptions,
  FormatCreateOfferReturn,
  FormatCreateRequestOptions,
  CredentialFormatCreateReturn,
  FormatAcceptRequestOptions,
  FormatAcceptOfferOptions,
  FormatAcceptProposalOptions,
  FormatAutoRespondCredentialOptions,
  FormatAutoRespondOfferOptions,
  FormatAutoRespondProposalOptions,
  FormatAutoRespondRequestOptions,
  FormatProcessCredentialOptions,
} from './CredentialFormatServiceOptions'

export interface CredentialFormatService<CF extends CredentialFormat = CredentialFormat> {
  formatKey: CF['formatKey']
  credentialRecordType: CF['credentialRecordType']

  // proposal methods
  createProposal(
    agentContext: AgentContext,
    options: FormatCreateProposalOptions<CF>
  ): Promise<FormatCreateProposalReturn>
  processProposal(agentContext: AgentContext, options: FormatProcessOptions): Promise<void>
  acceptProposal(agentContext: AgentContext, options: FormatAcceptProposalOptions<CF>): Promise<FormatCreateOfferReturn>

  // offer methods
  createOffer(agentContext: AgentContext, options: FormatCreateOfferOptions<CF>): Promise<FormatCreateOfferReturn>
  processOffer(agentContext: AgentContext, options: FormatProcessOptions): Promise<void>
  acceptOffer(agentContext: AgentContext, options: FormatAcceptOfferOptions<CF>): Promise<CredentialFormatCreateReturn>

  // request methods
  createRequest(
    agentContext: AgentContext,
    options: FormatCreateRequestOptions<CF>
  ): Promise<CredentialFormatCreateReturn>
  processRequest(agentContext: AgentContext, options: FormatProcessOptions): Promise<void>
  acceptRequest(
    agentContext: AgentContext,
    options: FormatAcceptRequestOptions<CF>
  ): Promise<CredentialFormatCreateReturn>

  // credential methods
  processCredential(agentContext: AgentContext, options: FormatProcessCredentialOptions): Promise<void>

  // auto accept methods
  shouldAutoRespondToProposal(agentContext: AgentContext, options: FormatAutoRespondProposalOptions): boolean
  shouldAutoRespondToOffer(agentContext: AgentContext, options: FormatAutoRespondOfferOptions): boolean
  shouldAutoRespondToRequest(agentContext: AgentContext, options: FormatAutoRespondRequestOptions): boolean
  shouldAutoRespondToCredential(agentContext: AgentContext, options: FormatAutoRespondCredentialOptions): boolean

  deleteCredentialById(agentContext: AgentContext, credentialId: string): Promise<void>

  supportsFormat(format: string): boolean

  getFormatData(data: unknown, id: string): V1Attachment
}
