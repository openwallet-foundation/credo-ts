import type { AgentMessage } from '../../agent/AgentMessage'
import type { HandlerInboundMessage } from '../../agent/Handler'
import type { PresentationRecordType } from './PresentationExchangeRecord'
import type { PresentationPreview } from './PresentationPreview'
import type { ProofProtocolVersion } from './ProofProtocolVersion'
import type { ProofRecord } from './repository'
import type { ProofRequest, RetrievedCredentials } from './v1/models'
import type { ProofFormatService } from './v2/formats/ProofFormatService'
import type { V2ProposePresentationHandler } from './v2/handlers/V2ProposePresentationHandler'
import type {
  CreateRequestOptions,
  ProofRequestAsResponse,
  ProofRequestsOptions,
  ProposeProofOptions,
  RequestProofOptions,
} from './v2/interface'

import { ConsoleLogger, LogLevel } from '../../logger'

const logger = new ConsoleLogger(LogLevel.debug)

export abstract class ProofService {
  abstract getVersion(): ProofProtocolVersion
  abstract createProposal(proposal: ProposeProofOptions): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>

  abstract requestProof(
    requestProofOptions: RequestProofOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>

  abstract createRequest(
    createRequestOptions: CreateRequestOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>

  public getFormatService(presentationRecordType: PresentationRecordType): ProofFormatService {
    logger.debug(presentationRecordType.toString())
    throw Error('Not Implemented')
  }

  abstract processProposal(messageContext: HandlerInboundMessage<V2ProposePresentationHandler>): Promise<ProofRecord>

  abstract getById(proofRecordId: string): Promise<ProofRecord>

  abstract getRequestedCredentialsForProofRequest(
    proofRequest: ProofRequest,
    presentationProposal?: PresentationPreview
  ): Promise<RetrievedCredentials>

  abstract createProofRequestFromProposal(
    presentationProposal: PresentationPreview,
    proofRequestOptions: ProofRequestsOptions
  ): Promise<ProofRequest>

  abstract createRequestAsResponse(
    proofRequestAsResponse: ProofRequestAsResponse
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>
}
