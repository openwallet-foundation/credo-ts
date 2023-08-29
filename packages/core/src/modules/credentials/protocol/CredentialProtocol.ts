import type {
  CreateCredentialProposalOptions,
  CredentialProtocolMsgReturnType,
  DeleteCredentialOptions,
  AcceptCredentialProposalOptions,
  NegotiateCredentialProposalOptions,
  CreateCredentialOfferOptions,
  NegotiateCredentialOfferOptions,
  CreateCredentialRequestOptions,
  AcceptCredentialOfferOptions,
  AcceptCredentialRequestOptions,
  AcceptCredentialOptions,
  GetCredentialFormatDataReturn,
  CreateCredentialProblemReportOptions,
} from './CredentialProtocolOptions'
import type { AgentContext } from '../../../agent'
import type { AgentBaseMessage } from '../../../agent/AgentBaseMessage'
import type { FeatureRegistry } from '../../../agent/FeatureRegistry'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { DependencyManager } from '../../../plugins'
import type { Query } from '../../../storage/StorageService'
import type { ProblemReportMessage, V2ProblemReportMessage } from '../../problem-reports'
import type { CredentialFormatService, ExtractCredentialFormats } from '../formats'
import type { CredentialState } from '../models/CredentialState'
import type { CredentialExchangeRecord } from '../repository'

export interface CredentialProtocol<CFs extends CredentialFormatService[] = CredentialFormatService[]> {
  readonly version: string

  // methods for proposal
  createProposal(
    agentContext: AgentContext,
    options: CreateCredentialProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentBaseMessage>>
  processProposal(messageContext: InboundMessageContext<AgentBaseMessage>): Promise<CredentialExchangeRecord>
  acceptProposal(
    agentContext: AgentContext,
    options: AcceptCredentialProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentBaseMessage>>
  negotiateProposal(
    agentContext: AgentContext,
    options: NegotiateCredentialProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentBaseMessage>>

  // methods for offer
  createOffer(
    agentContext: AgentContext,
    options: CreateCredentialOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentBaseMessage>>
  processOffer(messageContext: InboundMessageContext<AgentBaseMessage>): Promise<CredentialExchangeRecord>
  acceptOffer(
    agentContext: AgentContext,
    options: AcceptCredentialOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentBaseMessage>>
  negotiateOffer(
    agentContext: AgentContext,
    options: NegotiateCredentialOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentBaseMessage>>

  // methods for request
  createRequest(
    agentContext: AgentContext,
    options: CreateCredentialRequestOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentBaseMessage>>
  processRequest(messageContext: InboundMessageContext<AgentBaseMessage>): Promise<CredentialExchangeRecord>
  acceptRequest(
    agentContext: AgentContext,
    options: AcceptCredentialRequestOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentBaseMessage>>

  // methods for issue
  processCredential(messageContext: InboundMessageContext<AgentBaseMessage>): Promise<CredentialExchangeRecord>
  acceptCredential(
    agentContext: AgentContext,
    options: AcceptCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<AgentBaseMessage>>

  // methods for ack
  processAck(messageContext: InboundMessageContext<AgentBaseMessage>): Promise<CredentialExchangeRecord>

  // methods for problem-report
  createProblemReport(
    agentContext: AgentContext,
    options: CreateCredentialProblemReportOptions
  ): Promise<CredentialProtocolMsgReturnType<ProblemReportMessage | V2ProblemReportMessage>>
  processProblemReport(
    messageContext: InboundMessageContext<ProblemReportMessage | V2ProblemReportMessage>
  ): Promise<CredentialExchangeRecord>

  findProposalMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<AgentBaseMessage | null>
  findOfferMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<AgentBaseMessage | null>
  findRequestMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<AgentBaseMessage | null>
  findCredentialMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<AgentBaseMessage | null>
  getFormatData(
    agentContext: AgentContext,
    credentialExchangeId: string
  ): Promise<GetCredentialFormatDataReturn<ExtractCredentialFormats<CFs>>>

  // Repository methods
  updateState(
    agentContext: AgentContext,
    credentialRecord: CredentialExchangeRecord,
    newState: CredentialState
  ): Promise<void>
  getById(agentContext: AgentContext, credentialExchangeId: string): Promise<CredentialExchangeRecord>
  getAll(agentContext: AgentContext): Promise<CredentialExchangeRecord[]>
  findAllByQuery(
    agentContext: AgentContext,
    query: Query<CredentialExchangeRecord>
  ): Promise<CredentialExchangeRecord[]>
  findById(agentContext: AgentContext, credentialExchangeId: string): Promise<CredentialExchangeRecord | null>
  delete(
    agentContext: AgentContext,
    credentialRecord: CredentialExchangeRecord,
    options?: DeleteCredentialOptions
  ): Promise<void>
  getByThreadAndConnectionId(
    agentContext: AgentContext,
    threadId: string,
    connectionId?: string
  ): Promise<CredentialExchangeRecord>
  findByThreadAndConnectionId(
    agentContext: AgentContext,
    threadId: string,
    connectionId?: string
  ): Promise<CredentialExchangeRecord | null>
  update(agentContext: AgentContext, credentialRecord: CredentialExchangeRecord): Promise<void>

  register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry): void
}
