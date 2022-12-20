import type { AgentContext } from '../../../agent'
import type { FeatureRegistry } from '../../../agent/FeatureRegistry'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { DidCommV1Message } from '../../../didcomm'
import type { DependencyManager } from '../../../plugins'
import type { Query } from '../../../storage/StorageService'
import type { ProblemReportMessage } from '../../problem-reports'
import type {
  CreateProposalOptions,
  CredentialProtocolMsgReturnType,
  DeleteCredentialOptions,
  AcceptProposalOptions,
  NegotiateProposalOptions,
  CreateOfferOptions,
  NegotiateOfferOptions,
  CreateRequestOptions,
  AcceptOfferOptions,
  AcceptRequestOptions,
  AcceptCredentialOptions,
  GetFormatDataReturn,
  CreateProblemReportOptions,
} from '../CredentialProtocolOptions'
import type { CredentialFormatService, ExtractCredentialFormats } from '../formats'
import type { CredentialState } from '../models/CredentialState'
import type { CredentialExchangeRecord } from '../repository'

export interface CredentialProtocol<CFs extends CredentialFormatService[] = CredentialFormatService[]> {
  readonly version: string

  // methods for proposal
  createProposal(
    agentContext: AgentContext,
    options: CreateProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommV1Message>>
  processProposal(messageContext: InboundMessageContext<DidCommV1Message>): Promise<CredentialExchangeRecord>
  acceptProposal(
    agentContext: AgentContext,
    options: AcceptProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommV1Message>>
  negotiateProposal(
    agentContext: AgentContext,
    options: NegotiateProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommV1Message>>

  // methods for offer
  createOffer(
    agentContext: AgentContext,
    options: CreateOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommV1Message>>
  processOffer(messageContext: InboundMessageContext<DidCommV1Message>): Promise<CredentialExchangeRecord>
  acceptOffer(
    agentContext: AgentContext,
    options: AcceptOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommV1Message>>
  negotiateOffer(
    agentContext: AgentContext,
    options: NegotiateOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommV1Message>>

  // methods for request
  createRequest(
    agentContext: AgentContext,
    options: CreateRequestOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommV1Message>>
  processRequest(messageContext: InboundMessageContext<DidCommV1Message>): Promise<CredentialExchangeRecord>
  acceptRequest(
    agentContext: AgentContext,
    options: AcceptRequestOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommV1Message>>

  // methods for issue
  processCredential(messageContext: InboundMessageContext<DidCommV1Message>): Promise<CredentialExchangeRecord>
  acceptCredential(
    agentContext: AgentContext,
    options: AcceptCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<DidCommV1Message>>

  // methods for ack
  processAck(messageContext: InboundMessageContext<DidCommV1Message>): Promise<CredentialExchangeRecord>

  // methods for problem-report
  createProblemReport(agentContext: AgentContext, options: CreateProblemReportOptions): ProblemReportMessage

  findProposalMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<DidCommV1Message | null>
  findOfferMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<DidCommV1Message | null>
  findRequestMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<DidCommV1Message | null>
  findCredentialMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<DidCommV1Message | null>
  getFormatData(
    agentContext: AgentContext,
    credentialExchangeId: string
  ): Promise<GetFormatDataReturn<ExtractCredentialFormats<CFs>>>

  declineOffer(
    agentContext: AgentContext,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialExchangeRecord>
  processProblemReport(messageContext: InboundMessageContext<ProblemReportMessage>): Promise<CredentialExchangeRecord>

  // Repository methods
  updateState(
    agentContext: AgentContext,
    credentialRecord: CredentialExchangeRecord,
    newState: CredentialState
  ): Promise<void>
  getById(agentContext: AgentContext, credentialRecordId: string): Promise<CredentialExchangeRecord>
  getAll(agentContext: AgentContext): Promise<CredentialExchangeRecord[]>
  findAllByQuery(
    agentContext: AgentContext,
    query: Query<CredentialExchangeRecord>
  ): Promise<CredentialExchangeRecord[]>
  findById(agentContext: AgentContext, connectionId: string): Promise<CredentialExchangeRecord | null>
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
