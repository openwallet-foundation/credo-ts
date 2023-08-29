import type {
  CreateProofProposalOptions,
  CreateProofRequestOptions,
  DeleteProofOptions,
  GetProofFormatDataReturn,
  CreateProofProblemReportOptions,
  ProofProtocolMsgReturnType,
  AcceptProofProposalOptions,
  NegotiateProofProposalOptions,
  AcceptProofRequestOptions,
  NegotiateProofRequestOptions,
  AcceptPresentationOptions,
  GetCredentialsForRequestOptions,
  GetCredentialsForRequestReturn,
  SelectCredentialsForRequestOptions,
  SelectCredentialsForRequestReturn,
} from './ProofProtocolOptions'
import type { AgentBaseMessage } from '../../../agent/AgentBaseMessage'
import type { FeatureRegistry } from '../../../agent/FeatureRegistry'
import type { AgentContext } from '../../../agent/context/AgentContext'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { DependencyManager } from '../../../plugins'
import type { Query } from '../../../storage/StorageService'
import type { ProblemReportMessage, V2ProblemReportMessage } from '../../problem-reports'
import type { ExtractProofFormats, ProofFormatService } from '../formats'
import type { ProofState } from '../models/ProofState'
import type { ProofExchangeRecord } from '../repository'

export interface ProofProtocol<PFs extends ProofFormatService[] = ProofFormatService[]> {
  readonly version: string

  // methods for proposal
  createProposal(
    agentContext: AgentContext,
    options: CreateProofProposalOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<AgentBaseMessage>>
  processProposal(messageContext: InboundMessageContext<AgentBaseMessage>): Promise<ProofExchangeRecord>
  acceptProposal(
    agentContext: AgentContext,
    options: AcceptProofProposalOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<AgentBaseMessage>>
  negotiateProposal(
    agentContext: AgentContext,
    options: NegotiateProofProposalOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<AgentBaseMessage>>

  // methods for request
  createRequest(
    agentContext: AgentContext,
    options: CreateProofRequestOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<AgentBaseMessage>>
  processRequest(messageContext: InboundMessageContext<AgentBaseMessage>): Promise<ProofExchangeRecord>
  acceptRequest(
    agentContext: AgentContext,
    options: AcceptProofRequestOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<AgentBaseMessage>>
  negotiateRequest(
    agentContext: AgentContext,
    options: NegotiateProofRequestOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<AgentBaseMessage>>

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
  processPresentation(messageContext: InboundMessageContext<AgentBaseMessage>): Promise<ProofExchangeRecord>
  acceptPresentation(
    agentContext: AgentContext,
    options: AcceptPresentationOptions
  ): Promise<ProofProtocolMsgReturnType<AgentBaseMessage>>

  // methods for ack
  processAck(messageContext: InboundMessageContext<AgentBaseMessage>): Promise<ProofExchangeRecord>

  // method for problem report
  createProblemReport(
    agentContext: AgentContext,
    options: CreateProofProblemReportOptions
  ): Promise<ProofProtocolMsgReturnType<ProblemReportMessage | V2ProblemReportMessage>>
  processProblemReport(
    messageContext: InboundMessageContext<ProblemReportMessage | V2ProblemReportMessage>
  ): Promise<ProofExchangeRecord>

  findProposalMessage(agentContext: AgentContext, proofExchangeId: string): Promise<AgentBaseMessage | null>
  findRequestMessage(agentContext: AgentContext, proofExchangeId: string): Promise<AgentBaseMessage | null>
  findPresentationMessage(agentContext: AgentContext, proofExchangeId: string): Promise<AgentBaseMessage | null>
  getFormatData(
    agentContext: AgentContext,
    proofExchangeId: string
  ): Promise<GetProofFormatDataReturn<ExtractProofFormats<PFs>>>

  // repository methods
  updateState(agentContext: AgentContext, proofRecord: ProofExchangeRecord, newState: ProofState): Promise<void>
  getById(agentContext: AgentContext, proofExchangeId: string): Promise<ProofExchangeRecord>
  getAll(agentContext: AgentContext): Promise<ProofExchangeRecord[]>
  findAllByQuery(agentContext: AgentContext, query: Query<ProofExchangeRecord>): Promise<ProofExchangeRecord[]>
  findById(agentContext: AgentContext, proofExchangeId: string): Promise<ProofExchangeRecord | null>
  delete(agentContext: AgentContext, proofRecord: ProofExchangeRecord, options?: DeleteProofOptions): Promise<void>
  getByThreadAndConnectionId(
    agentContext: AgentContext,
    threadId: string,
    connectionId?: string
  ): Promise<ProofExchangeRecord>
  findByThreadAndConnectionId(
    agentContext: AgentContext,
    threadId: string,
    connectionId?: string
  ): Promise<ProofExchangeRecord | null>
  update(agentContext: AgentContext, proofRecord: ProofExchangeRecord): Promise<void>

  register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry): void
}
