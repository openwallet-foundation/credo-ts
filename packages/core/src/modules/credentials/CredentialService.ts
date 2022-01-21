/* eslint-disable @typescript-eslint/no-unused-vars */
import type { AgentMessage } from '../../agent/AgentMessage'
import type { Handler, HandlerInboundMessage } from '../../agent/Handler'
import type { InboundMessageContext } from '../../agent/models/InboundMessageContext'
import type { CredentialProtocolVersion } from './CredentialProtocolVersion'
import type {
  AcceptProposalOptions,
  NegotiateOfferOptions,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from './interfaces'
import type { CredentialRecord } from './repository'
import type { V1CredentialService } from './v1/V1CredentialService'
import type { CredentialProtocolMsgReturnType } from './v1/V1LegacyCredentialService'
import type { RequestCredentialMessage } from './v1/messages'
import type { CredentialFormatType, CredentialRecordType } from './v2/CredentialExchangeRecord'
import type { V2CredentialService } from './v2/V2CredentialService'
import type {
  CredentialFormatService,
  V2CredProposalFormat,
  V2CredProposeOfferRequestFormat,
} from './v2/formats/CredentialFormatService'
import type { V2RequestCredentialMessage } from './v2/messages/V2RequestCredentialMessage'

export type CredentialServiceType = V1CredentialService | V2CredentialService

export abstract class CredentialService {
  abstract getVersion(): CredentialProtocolVersion

  abstract getFormats(credentialFormats: V2CredProposeOfferRequestFormat): CredentialFormatService[]
  // methods for proposal
  abstract createProposal(
    proposal: ProposeCredentialOptions
  ): Promise<{ credentialRecord: CredentialRecord; message: AgentMessage }>
  abstract processProposal(messageContext: HandlerInboundMessage<Handler>): Promise<CredentialRecord>
  abstract acceptProposal(
    proposal: AcceptProposalOptions
  ): Promise<{ credentialRecord: CredentialRecord; message: AgentMessage }>
  abstract negotiateProposal(
    credentialOptions: NegotiateProposalOptions
  ): Promise<{ credentialRecord: CredentialRecord; message: AgentMessage }>

  // methods for offer
  abstract createOffer(
    credentialOptions: OfferCredentialOptions
  ): Promise<{ credentialRecord: CredentialRecord; message: AgentMessage }>
  abstract processOffer(messageContext: HandlerInboundMessage<Handler>): Promise<CredentialRecord>

  // methods for request
  abstract createRequest(
    credentialRecord: CredentialRecord,
    options: RequestCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<AgentMessage>>

  abstract processRequest(
    messageContext: InboundMessageContext<RequestCredentialMessage | V2RequestCredentialMessage>
  ): Promise<CredentialRecord>
  public getFormatService(credentialFormatType: CredentialFormatType): CredentialFormatService {
    throw Error('Not Implemented')
  }
}
