import type { AgentContext, Query, QueryOptions } from '@credo-ts/core'
import type { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import type { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommMessageHandlerRegistry } from '../../../DidCommMessageHandlerRegistry'
import type { ProblemReportMessage } from '../../../messages'
import type { InboundDidCommMessageContext } from '../../../models'
import type { CredentialFormatService, ExtractCredentialFormats } from '../formats'
import type { DidCommCredentialRole } from '../models'
import type { DidCommCredentialState } from '../models/DidCommCredentialState'
import type { DidCommCredentialExchangeRecord } from '../repository'
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
} from './DidCommCredentialProtocolOptions'

export interface DidCommCredentialProtocol<CFs extends CredentialFormatService[] = CredentialFormatService[]> {
  readonly version: string

  // methods for proposal
  createProposal(
    agentContext: AgentContext,
    options: CreateCredentialProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>
  processProposal(
    messageContext: InboundDidCommMessageContext<DidCommMessage>
  ): Promise<DidCommCredentialExchangeRecord>
  acceptProposal(
    agentContext: AgentContext,
    options: AcceptCredentialProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>
  negotiateProposal(
    agentContext: AgentContext,
    options: NegotiateCredentialProposalOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>

  // methods for offer
  createOffer(
    agentContext: AgentContext,
    options: CreateCredentialOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>
  processOffer(messageContext: InboundDidCommMessageContext<DidCommMessage>): Promise<DidCommCredentialExchangeRecord>
  acceptOffer(
    agentContext: AgentContext,
    options: AcceptCredentialOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>
  negotiateOffer(
    agentContext: AgentContext,
    options: NegotiateCredentialOfferOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>

  // methods for request
  createRequest(
    agentContext: AgentContext,
    options: CreateCredentialRequestOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>
  processRequest(messageContext: InboundDidCommMessageContext<DidCommMessage>): Promise<DidCommCredentialExchangeRecord>
  acceptRequest(
    agentContext: AgentContext,
    options: AcceptCredentialRequestOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>

  // methods for issue
  processCredential(
    messageContext: InboundDidCommMessageContext<DidCommMessage>
  ): Promise<DidCommCredentialExchangeRecord>
  acceptCredential(
    agentContext: AgentContext,
    options: AcceptCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>

  // methods for ack
  processAck(messageContext: InboundDidCommMessageContext<DidCommMessage>): Promise<DidCommCredentialExchangeRecord>

  // methods for problem-report
  createProblemReport(
    agentContext: AgentContext,
    options: CreateCredentialProblemReportOptions
  ): Promise<CredentialProtocolMsgReturnType<ProblemReportMessage>>
  processProblemReport(
    messageContext: InboundDidCommMessageContext<ProblemReportMessage>
  ): Promise<DidCommCredentialExchangeRecord>

  findProposalMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<DidCommMessage | null>
  findOfferMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<DidCommMessage | null>
  findRequestMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<DidCommMessage | null>
  findCredentialMessage(agentContext: AgentContext, credentialExchangeId: string): Promise<DidCommMessage | null>
  getFormatData(
    agentContext: AgentContext,
    credentialExchangeId: string
  ): Promise<GetCredentialFormatDataReturn<ExtractCredentialFormats<CFs>>>

  // Repository methods
  updateState(
    agentContext: AgentContext,
    credentialExchangeRecord: DidCommCredentialExchangeRecord,
    newState: DidCommCredentialState
  ): Promise<void>
  getById(agentContext: AgentContext, credentialExchangeId: string): Promise<DidCommCredentialExchangeRecord>
  getAll(agentContext: AgentContext): Promise<DidCommCredentialExchangeRecord[]>
  findAllByQuery(
    agentContext: AgentContext,
    query: Query<DidCommCredentialExchangeRecord>,
    queryOptions?: QueryOptions
  ): Promise<DidCommCredentialExchangeRecord[]>
  findById(agentContext: AgentContext, credentialExchangeId: string): Promise<DidCommCredentialExchangeRecord | null>
  delete(
    agentContext: AgentContext,
    credentialExchangeRecord: DidCommCredentialExchangeRecord,
    options?: DeleteCredentialOptions
  ): Promise<void>
  getByProperties(
    agentContext: AgentContext,
    properties: {
      threadId: string
      connectionId?: string
      role?: DidCommCredentialRole
    }
  ): Promise<DidCommCredentialExchangeRecord>
  findByProperties(
    agentContext: AgentContext,
    properties: {
      threadId: string
      connectionId?: string
      role?: DidCommCredentialRole
    }
  ): Promise<DidCommCredentialExchangeRecord | null>
  update(agentContext: AgentContext, credentialExchangeRecord: DidCommCredentialExchangeRecord): Promise<void>

  register(messageHandlerRegistry: DidCommMessageHandlerRegistry, featureRegistry: DidCommFeatureRegistry): void
}
