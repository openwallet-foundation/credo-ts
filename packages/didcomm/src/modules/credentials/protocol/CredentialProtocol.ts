import type { AgentContext, Query, QueryOptions } from '@credo-ts/core'
import type { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import type { DidCommMessageHandlerRegistry } from '../../../DidCommMessageHandlerRegistry'
import type { ProblemReportMessage } from '../../../messages'
import type { InboundDidCommMessageContext } from '../../../models'
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
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>
  processProposal(messageContext: InboundDidCommMessageContext<DidCommMessage>): Promise<CredentialExchangeRecord>
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
  processOffer(messageContext: InboundDidCommMessageContext<DidCommMessage>): Promise<CredentialExchangeRecord>
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
  processRequest(messageContext: InboundDidCommMessageContext<DidCommMessage>): Promise<CredentialExchangeRecord>
  acceptRequest(
    agentContext: AgentContext,
    options: AcceptCredentialRequestOptions<CFs>
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>

  // methods for issue
  processCredential(messageContext: InboundDidCommMessageContext<DidCommMessage>): Promise<CredentialExchangeRecord>
  acceptCredential(
    agentContext: AgentContext,
    options: AcceptCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<DidCommMessage>>

  // methods for ack
  processAck(messageContext: InboundDidCommMessageContext<DidCommMessage>): Promise<CredentialExchangeRecord>

  // methods for problem-report
  createProblemReport(
    agentContext: AgentContext,
    options: CreateCredentialProblemReportOptions
  ): Promise<CredentialProtocolMsgReturnType<ProblemReportMessage>>
  processProblemReport(messageContext: InboundDidCommMessageContext<ProblemReportMessage>): Promise<CredentialExchangeRecord>

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

  register(messageHandlerRegistry: DidCommMessageHandlerRegistry, featureRegistry: DidCommFeatureRegistry): void
}
