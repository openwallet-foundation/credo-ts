import type { AgentMessage } from '../../agent/AgentMessage'
import type { InboundMessageContext } from '../../agent/models/InboundMessageContext'
import type { ProofFormatService } from './formats/ProofFormatService'
import type { ProofProtocolVersion } from './models/ProofProtocolVersion'
import type {
  CreateProposalAsResponseOptions,
  CreateProposalOptions,
  CreateRequestAsResponseOptions,
  PresentationOptions,
  RequestProofOptions,
} from './models/ServiceOptions'
import type { RetrievedCredentials } from './protocol/v1/models'
import type { ProofRecord, ProofRepository } from './repository'
import type { PresentationRecordType } from './repository/PresentationExchangeRecord'

import { ConsoleLogger, LogLevel } from '../../logger'

const logger = new ConsoleLogger(LogLevel.debug)

/**
 * - creates records & messages
 * - stores records
 * - returns records & messages
 */

export abstract class ProofService {
  private proofRepository: ProofRepository

  public constructor(proofRepository: ProofRepository) {
    this.proofRepository = proofRepository
  }

  abstract getVersion(): ProofProtocolVersion

  /**
   * 1. Assert (connection ready, record state)
   * 1. Create proposal message
   * 2. loop through all formats from ProposeProofOptions and call format service
   * 3. Create and store proof record
   * 4. Store proposal message
   * 5. Return proposal message + proof record
   */
  abstract createProposal(options: CreateProposalOptions): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>

  /**
   * Create a proposal message in response to a received proof request message
   *
   * 1. assert record state
   * 1. Create proposal message
   * 2. loop through all formats from ProposeProofOptions and call format service
   * 3. Update proof record
   * 4. Create or update proposal message
   * 5. Return proposal message + proof record
   */
  abstract createProposalAsResponse(
    options: CreateProposalAsResponseOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>

  /**
   * Process a received proposal message (does not accept yet)
   *
   * 1. Find proof record by thread and connection id
   *
   * Two flows possible:
   * - Proof record already exist
   *    2. Assert state
   *    3. Save or update proposal message in storage (didcomm message record)
   *    4. Loop through all format services to process proposal message
   *    5. Update & return record
   *
   * - Proof record does not exist yet
   *    2. Create record
   *    3. Save proposal message
   *    4. Loop through all format services to process proposal message
   *    5. Save & return record
   */
  abstract processProposal(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord>

  abstract createRequest(options: RequestProofOptions): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>

  abstract createRequestAsResponse(
    options: CreateRequestAsResponseOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>

  abstract processRequest(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord>

  abstract createPresentation(
    options: PresentationOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>

  abstract processPresentation(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord>

  abstract createAck(options: CreateAckOptions): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>

  abstract processAck(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord>

  abstract createProblemReport(
    options: CreateProblemReportOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }>
  abstract processProblemReport(messageContext: InboundMessageContext<AgentMessage>): Promise<ProofRecord>

  abstract getRequestedCredentialsForProofRequest(options: {
    proofRecord: ProofRecord
  }): Promise<{ indy?: RetrievedCredentials; w3c?: never }>

  public getFormatService(presentationRecordType: PresentationRecordType): ProofFormatService {
    logger.debug(presentationRecordType.toString())
    throw Error('Not Implemented')
  }

  /**
   * Retrieve all proof records
   *
   * @returns List containing all proof records
   */
  public async getAll(): Promise<ProofRecord[]> {
    return this.proofRepository.getAll()
  }

  /**
   * Retrieve a proof record by id
   *
   * @param proofRecordId The proof record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The proof record
   *
   */
  public async getById(proofRecordId: string): Promise<ProofRecord> {
    return this.proofRepository.getById(proofRecordId)
  }

  /**
   * Retrieve a proof record by id
   *
   * @param proofRecordId The proof record id
   * @return The proof record or null if not found
   *
   */
  public async findById(proofRecordId: string): Promise<ProofRecord | null> {
    return this.proofRepository.findById(proofRecordId)
  }

  /**
   * Delete a proof record by id
   *
   * @param proofId the proof record id
   */
  public async deleteById(proofId: string) {
    const proofRecord = await this.getById(proofId)
    return this.proofRepository.delete(proofRecord)
  }
}
