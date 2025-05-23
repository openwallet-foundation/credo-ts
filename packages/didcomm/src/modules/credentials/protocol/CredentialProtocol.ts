import type { AgentContext, Query, QueryOptions } from '@credo-ts/core'
import type { AgentMessage } from '../../../AgentMessage'
import type { FeatureRegistry } from '../../../FeatureRegistry'
import type { MessageHandlerRegistry } from '../../../MessageHandlerRegistry'
import type { ProblemReportMessage } from '../../../messages'
import type { InboundMessageContext } from '../../../models'
import type { CredentialFormatService, ExtractCredentialFormats } from '../formats'
import type { CredentialRole } from '../models'
import type { CredentialState } from '../models/CredentialState'
import type { CredentialExchangeRecord } from '../repository'
import type {
  AcceptCredentialOfferOptions,
  AcceptCredentialOptions,
  AcceptCredentialProposalOptions,
  AcceptCredentialRequestOptions,
  CreateCredentialOfferOptions,
  CreateCredentialProblemReportOptions,
  CreateCredentialProposalOptions,
  CreateCredentialRequestOptions,
  CredentialProtocolMsgReturnType,
  DeleteCredentialOptions,
  GetCredentialFormatDataReturn,
  NegotiateCredentialOfferOptions,
  NegotiateCredentialProposalOptions,
} from './CredentialProtocolOptions'

export interface CredentialProtocol<CFs extends CredentialFormatService[] = CredentialFormatService[]> {
  readonly version: string

  // methods for proposal
  createProposal(
    agentContext: AgentContext,
    options: CreateCredentialProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>
  processProposal(messageContext: InboundMessageContext<AgentMessage>): Promise<CredentialExchangeRecord>
  acceptProposal(
    agentContext: AgentContext,
    options: AcceptCredentialProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>
  negotiateProposal(
    agentContext: AgentContext,
    options: NegotiateCredentialProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>

  // methods for offer
  createOffer(
    agentContext: AgentContext,
    options: CreateCredentialOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>
  processOffer(messageContext: InboundMessageContext<AgentMessage>): Promise<CredentialExchangeRecord>
  acceptOffer(
    agentContext: AgentContext,
    options: AcceptCredentialOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>
  negotiateOffer(
    agentContext: AgentContext,
    options: NegotiateCredentialOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>

  // methods for request
  createRequest(
    agentContext: AgentContext,
    options: CreateCredentialRequestOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>
  processRequest(messageContext: InboundMessageContext<AgentMessage>): Promise<CredentialExchangeRecord>
  acceptRequest(
    agentContext: AgentContext,
    options: AcceptCredentialRequestOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>

  // methods for issue
  processCredential(messageContext: InboundMessageContext<AgentMessage>): Promise<CredentialExchangeRecord>
  acceptCredential(
    agentContext: AgentContext,
    options: AcceptCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>

  // methods for ack
  processAck(messageContext: InboundMessageContext<AgentMessage>): Promise<CredentialExchangeRecord>

  // methods for problem-report
  createProblemReport(
    agentContext: AgentContext,
    options: CreateCredentialProblemReportOptions
  ): Promise<CredentialProtocolMsgReturnType<ProblemReportMessage>>
  processProblemReport(messageContext: InboundMessageContext<ProblemReportMessage>): Promise<CredentialExchangeRecord>

  findProposalMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<AgentMessage | null>
  findOfferMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<AgentMessage | null>
  findRequestMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<AgentMessage | null>
  findCredentialMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<AgentMessage | null>
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
    query: Query<CredentialExchangeRecord>,
    queryOptions?: QueryOptions
  ): Promise<CredentialExchangeRecord[]>
  findById(agentContext: AgentContext, credentialExchangeId: string): Promise<CredentialExchangeRecord | null>
  delete(
    agentContext: AgentContext,
    credentialRecord: CredentialExchangeRecord,
    options?: DeleteCredentialOptions
  ): Promise<void>
  getByProperties(
    agentContext: AgentContext,
    properties: {
      threadId: string
      connectionId?: string
      role?: CredentialRole
    }
  ): Promise<CredentialExchangeRecord>
  findByProperties(
    agentContext: AgentContext,
    properties: {
      threadId: string
      connectionId?: string
      role?: CredentialRole
    }
  ): Promise<CredentialExchangeRecord | null>
  update(agentContext: AgentContext, credentialRecord: CredentialExchangeRecord): Promise<void>

  register(messageHandlerRegistry: MessageHandlerRegistry, featureRegistry: FeatureRegistry): void
}
