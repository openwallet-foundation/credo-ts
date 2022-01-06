import { AgentMessage } from '@aries-framework/core'
import { CredentialRecordType } from './v2/CredentialExchangeRecord'
import { AcceptProposalOptions, ProposeCredentialOptions } from './v2/interfaces'
import { CredentialRecord } from './repository'
import { ConsoleLogger, LogLevel } from '../../logger'
import { CredentialProtocolVersion } from './CredentialProtocolVersion'
import { CredentialFormatService } from './v2/formats/CredentialFormatService'
import { Handler, HandlerInboundMessage } from '../../agent/Handler'

const logger = new ConsoleLogger(LogLevel.debug)

export abstract class CredentialService {
  abstract getVersion(): CredentialProtocolVersion
  
  // methods for proposal
  abstract createProposal(proposal: ProposeCredentialOptions): Promise<{ credentialRecord: CredentialRecord, message: AgentMessage }>
  abstract processProposal(messageContext: HandlerInboundMessage<Handler>): Promise<CredentialRecord> 
  abstract acceptProposal(proposal: AcceptProposalOptions): Promise<{ credentialRecord: CredentialRecord, message: AgentMessage }>

  // methods for offer
  abstract processOffer(messageContext: HandlerInboundMessage<Handler>): Promise<CredentialRecord> 
  
  getFormatService(credentialRecordType: CredentialRecordType): CredentialFormatService {
    throw Error("Not Implemented")
  }
}





