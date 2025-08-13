import type { AgentContext, Query, QueryOptions } from '@credo-ts/core'
import type { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import type { DidCommMessageHandlerRegistry } from '../../../DidCommMessageHandlerRegistry'
import type { ProblemReportMessage } from '../../../messages'
import type { InboundDidCommMessageContext } from '../../../models'
import type { ExtractProofFormats, ProofFormatService } from '../formats'
import type { DidCommProofRole } from '../models'
import type { DidCommProofState } from '../models/DidCommProofState'
import type { DidCommProofExchangeRecord } from '../repository'
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
} from './DidCommProofProtocolOptions'

export interface DidCommProofProtocol<PFs extends ProofFormatService[] = ProofFormatService[]> {
  readonly version: string

  // methods for proposal
  createProposal(
    agentContext: AgentContext,
    options: CreateProofProposalOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<DidCommMessage>>
  processProposal(messageContext: InboundDidCommMessageContext<DidCommMessage>): Promise<DidCommProofExchangeRecord>
  acceptProposal(
    agentContext: AgentContext,
    options: AcceptProofProposalOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<DidCommMessage>>
  negotiateProposal(
    agentContext: AgentContext,
    options: NegotiateProofProposalOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<DidCommMessage>>

  // methods for request
  createRequest(
    agentContext: AgentContext,
    options: CreateProofRequestOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<DidCommMessage>>
  processRequest(messageContext: InboundDidCommMessageContext<DidCommMessage>): Promise<DidCommProofExchangeRecord>
  acceptRequest(
    agentContext: AgentContext,
    options: AcceptProofRequestOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<DidCommMessage>>
  negotiateRequest(
    agentContext: AgentContext,
    options: NegotiateProofRequestOptions<PFs>
  ): Promise<ProofProtocolMsgReturnType<DidCommMessage>>

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
  processPresentation(messageContext: InboundDidCommMessageContext<DidCommMessage>): Promise<DidCommProofExchangeRecord>
  acceptPresentation(
    agentContext: AgentContext,
    options: AcceptPresentationOptions
  ): Promise<ProofProtocolMsgReturnType<DidCommMessage>>

  // methods for ack
  processAck(messageContext: InboundDidCommMessageContext<DidCommMessage>): Promise<DidCommProofExchangeRecord>

  // method for problem report
  createProblemReport(
    agentContext: AgentContext,
    options: CreateProofProblemReportOptions
  ): Promise<ProofProtocolMsgReturnType<ProblemReportMessage>>
  processProblemReport(messageContext: InboundDidCommMessageContext<ProblemReportMessage>): Promise<DidCommProofExchangeRecord>

  findProposalMessage(agentContext: AgentContext, proofExchangeId: string): Promise<DidCommMessage | null>
  findRequestMessage(agentContext: AgentContext, proofExchangeId: string): Promise<DidCommMessage | null>
  findPresentationMessage(agentContext: AgentContext, proofExchangeId: string): Promise<DidCommMessage | null>
  getFormatData(
    agentContext: AgentContext,
    proofExchangeId: string
  ): Promise<GetProofFormatDataReturn<ExtractProofFormats<PFs>>>

  // repository methods
  updateState(agentContext: AgentContext, proofRecord: DidCommProofExchangeRecord, newState: DidCommProofState): Promise<void>
  getById(agentContext: AgentContext, proofExchangeId: string): Promise<DidCommProofExchangeRecord>
  getAll(agentContext: AgentContext): Promise<DidCommProofExchangeRecord[]>
  findAllByQuery(
    agentContext: AgentContext,
    query: Query<DidCommProofExchangeRecord>,
    queryOptions?: QueryOptions
  ): Promise<DidCommProofExchangeRecord[]>
  findById(agentContext: AgentContext, proofExchangeId: string): Promise<DidCommProofExchangeRecord | null>
  delete(agentContext: AgentContext, proofRecord: DidCommProofExchangeRecord, options?: DeleteProofOptions): Promise<void>
  getByProperties(
    agentContext: AgentContext,
    properties: {
      threadId: string
      connectionId?: string
      role?: DidCommProofRole
    }
  ): Promise<DidCommProofExchangeRecord>
  findByProperties(
    agentContext: AgentContext,
    properties: {
      threadId: string
      connectionId?: string
      role?: DidCommProofRole
    }
  ): Promise<DidCommProofExchangeRecord | null>
  update(agentContext: AgentContext, proofRecord: DidCommProofExchangeRecord): Promise<void>

  register(messageHandlerRegistry: DidCommMessageHandlerRegistry, featureRegistry: DidCommFeatureRegistry): void
}
