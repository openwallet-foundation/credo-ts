import type { AgentMessage } from '../../agent/AgentMessage'
import type { HandlerInboundMessage } from '../../agent/Handler'
import type { PresentationRecordType } from './PresentationExchangeRecord'
import type { ProofProtocolVersion } from './ProofProtocolVersion'
import type { ProofRecord } from './repository'
import type { ProofFormatService } from './v2/formats/ProofFormatService'
import type { V2ProposePresentationHandler } from './v2/handlers/V2ProposePresentationHandler'
import type { ProposeProofOptions } from './v2/interface'

import { ConsoleLogger, LogLevel } from '../../logger'

const logger = new ConsoleLogger(LogLevel.debug)

export abstract class ProofService {
  abstract getVersion(): ProofProtocolVersion
  abstract createProposal(proposal: ProposeProofOptions): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>
  public getFormatService(presentationRecordType: PresentationRecordType): ProofFormatService {
    throw Error('Not Implemented')
  }
  abstract processProposal(messageContext: HandlerInboundMessage<V2ProposePresentationHandler>): Promise<ProofRecord>
}
