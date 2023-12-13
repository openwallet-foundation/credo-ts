import type { PresentationExchangeProofFormat } from './PresentationExchangeProofFormat'
import type { AgentContext } from '../../../../agent'
import type { ProofFormatService } from '../ProofFormatService'
import type {
  ProofFormatCreateProposalOptions,
  ProofFormatCreateReturn,
  ProofFormatProcessOptions,
  ProofFormatAcceptProposalOptions,
  FormatCreateRequestOptions,
  ProofFormatAcceptRequestOptions,
  ProofFormatProcessPresentationOptions,
  ProofFormatGetCredentialsForRequestOptions,
  ProofFormatSelectCredentialsForRequestOptions,
  ProofFormatAutoRespondProposalOptions,
  ProofFormatAutoRespondRequestOptions,
  ProofFormatAutoRespondPresentationOptions,
} from '../ProofFormatServiceOptions'

const PRESENTATION_EXCHANGE_PRESENTATION_PROPOSAL = 'dif/presentation-exchange/definitions@v1.0'
const PRESENTATION_EXCHANGE_PRESENTATION_REQUEST = 'dif/presentation-exchange/definitions@v1.0'
const PRESENTATION_EXCHANGE_PRESENTATION = 'dif/presentation-exchange/submission@v1.0'

export class PresentationExchangeProofFormatService implements ProofFormatService<PresentationExchangeProofFormat> {
  public readonly formatKey = 'presentationExchange' as const

  public supportsFormat(formatIdentifier: string): boolean {
    return [
      PRESENTATION_EXCHANGE_PRESENTATION_PROPOSAL,
      PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
      PRESENTATION_EXCHANGE_PRESENTATION,
    ].includes(formatIdentifier)
  }

  public createProposal(
    agentContext: AgentContext,
    options: ProofFormatCreateProposalOptions<PresentationExchangeProofFormat>
  ): Promise<ProofFormatCreateReturn> {
    throw new Error('Method not implemented.')
  }

  public processProposal(agentContext: AgentContext, options: ProofFormatProcessOptions): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public acceptProposal(
    agentContext: AgentContext,
    options: ProofFormatAcceptProposalOptions<PresentationExchangeProofFormat>
  ): Promise<ProofFormatCreateReturn> {
    throw new Error('Method not implemented.')
  }

  public createRequest(
    agentContext: AgentContext,
    options: FormatCreateRequestOptions<PresentationExchangeProofFormat>
  ): Promise<ProofFormatCreateReturn> {
    throw new Error('Method not implemented.')
  }

  public processRequest(agentContext: AgentContext, options: ProofFormatProcessOptions): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public acceptRequest(
    agentContext: AgentContext,
    options: ProofFormatAcceptRequestOptions<PresentationExchangeProofFormat>
  ): Promise<ProofFormatCreateReturn> {
    throw new Error('Method not implemented.')
  }

  public processPresentation(
    agentContext: AgentContext,
    options: ProofFormatProcessPresentationOptions
  ): Promise<boolean> {
    throw new Error('Method not implemented.')
  }

  public getCredentialsForRequest(
    agentContext: AgentContext,
    options: ProofFormatGetCredentialsForRequestOptions<PresentationExchangeProofFormat>
  ): Promise<unknown> {
    throw new Error('Method not implemented.')
  }

  public selectCredentialsForRequest(
    agentContext: AgentContext,
    options: ProofFormatSelectCredentialsForRequestOptions<PresentationExchangeProofFormat>
  ): Promise<unknown> {
    throw new Error('Method not implemented.')
  }

  public shouldAutoRespondToProposal(
    agentContext: AgentContext,
    options: ProofFormatAutoRespondProposalOptions
  ): Promise<boolean> {
    throw new Error('Method not implemented.')
  }

  public shouldAutoRespondToRequest(
    agentContext: AgentContext,
    options: ProofFormatAutoRespondRequestOptions
  ): Promise<boolean> {
    throw new Error('Method not implemented.')
  }

  public shouldAutoRespondToPresentation(
    agentContext: AgentContext,
    options: ProofFormatAutoRespondPresentationOptions
  ): Promise<boolean> {
    throw new Error('Method not implemented.')
  }
}
