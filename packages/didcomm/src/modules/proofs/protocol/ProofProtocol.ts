import type { AgentContext, Query, QueryOptions } from '@credo-ts/core'
import type { AgentMessage } from '../../../AgentMessage'
import type { FeatureRegistry } from '../../../FeatureRegistry'
import type { MessageHandlerRegistry } from '../../../MessageHandlerRegistry'
import type { ProblemReportMessage } from '../../../messages'
import type { InboundMessageContext } from '../../../models'
import type { ExtractProofFormats, ProofFormatService } from '../formats'
import type { ProofRole } from '../models'
import type { ProofState } from '../models/ProofState'
import type { ProofExchangeRecord } from '../repository'
import type {
  AcceptPresentationOptions,
  AcceptProofProposalOptions,
  AcceptProofRequestOptions,
  CreateProofProblemReportOptions,
  CreateProofProposalOptions,
  CreateProofRequestOptions,
  DeleteProofOptions,
  GetCredentialsForRequestOptions,
  GetCredentialsForRequestReturn,
  GetProofFormatDataReturn,
  NegotiateProofProposalOptions,
  NegotiateProofRequestOptions,
  ProofProtocolMsgReturnType,
  SelectCredentialsForRequestOptions,
  SelectCredentialsForRequestReturn,
} from './ProofProtocolOptions'

export interface ProofProtocol<PFs extends ProofFormatService[] = ProofFormatService[]> {
  readonly version: string

  // methods for proposal
  createProposal(
    agentContext: AgentContext,
    options: CreateProofProposalOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<AgentMessage>>
  processProposal(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofExchangeRecord>
  acceptProposal(
    agentContext: AgentContext,
    options: AcceptProofProposalOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<AgentMessage>>
  negotiateProposal(
    agentContext: AgentContext,
    options: NegotiateProofProposalOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<AgentMessage>>

  // methods for request
  createRequest(
    agentContext: AgentContext,
    options: CreateProofRequestOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<AgentMessage>>
  processRequest(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofExchangeRecord>
  acceptRequest(
    agentContext: AgentContext,
    options: AcceptProofRequestOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<AgentMessage>>
  negotiateRequest(
    agentContext: AgentContext,
    options: NegotiateProofRequestOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<AgentMessage>>

  // retrieving credentials for request
  getCredentialsForRequest(
    agentContext: AgentContext,
    options: GetCredentialsForRequestOptions<PFs>
  ): Promise<GetCredentialsForRequestReturn<PFs>>
  selectCredentialsForRequest(
    agentContext: AgentContext,
    options: SelectCredentialsForRequestOptions<PFs>
  ): Promise<SelectCredentialsForRequestReturn<PFs>>

  // methods for presentation
  processPresentation(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofExchangeRecord>
  acceptPresentation(
    agentContext: AgentContext,
    options: AcceptPresentationOptions
  ): Promise<ProofProtocolMsgReturnType<AgentMessage>>

  // methods for ack
  processAck(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofExchangeRecord>

  // method for problem report
  createProblemReport(
    agentContext: AgentContext,
    options: CreateProofProblemReportOptions
  ): Promise<ProofProtocolMsgReturnType<ProblemReportMessage>>
  processProblemReport(messageContext: InboundMessageContext<ProblemReportMessage>): Promise<ProofExchangeRecord>

  findProposalMessage(agentContext: AgentContext, proofExchangeId: string): Promise<AgentMessage | null>
  findRequestMessage(agentContext: AgentContext, proofExchangeId: string): Promise<AgentMessage | null>
  findPresentationMessage(agentContext: AgentContext, proofExchangeId: string): Promise<AgentMessage | null>
  getFormatData(
    agentContext: AgentContext,
    proofExchangeId: string
  ): Promise<GetProofFormatDataReturn<ExtractProofFormats<PFs>>>

  // repository methods
  updateState(agentContext: AgentContext, proofRecord: ProofExchangeRecord, newState: ProofState): Promise<void>
  getById(agentContext: AgentContext, proofExchangeId: string): Promise<ProofExchangeRecord>
  getAll(agentContext: AgentContext): Promise<ProofExchangeRecord[]>
  findAllByQuery(
    agentContext: AgentContext,
    query: Query<ProofExchangeRecord>,
    queryOptions?: QueryOptions
  ): Promise<ProofExchangeRecord[]>
  findById(agentContext: AgentContext, proofExchangeId: string): Promise<ProofExchangeRecord | null>
  delete(agentContext: AgentContext, proofRecord: ProofExchangeRecord, options?: DeleteProofOptions): Promise<void>
  getByProperties(
    agentContext: AgentContext,
    properties: {
      threadId: string
      connectionId?: string
      role?: ProofRole
    }
  ): Promise<ProofExchangeRecord>
  findByProperties(
    agentContext: AgentContext,
    properties: {
      threadId: string
      connectionId?: string
      role?: ProofRole
    }
  ): Promise<ProofExchangeRecord | null>
  update(agentContext: AgentContext, proofRecord: ProofExchangeRecord): Promise<void>

  register(messageHandlerRegistry: MessageHandlerRegistry, featureRegistry: FeatureRegistry): void
}
