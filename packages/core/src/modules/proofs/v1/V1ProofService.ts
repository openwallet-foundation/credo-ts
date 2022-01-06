import type { AgentMessage } from '../../../agent/AgentMessage'
import type { HandlerInboundMessage } from '../../../agent/Handler'
import type { AutoAcceptProof } from '../ProofAutoAcceptType'
import type { ProofRecord } from '../repository/ProofRecord'
import type { V2ProposePresentationHandler } from '../v2/handlers/V2ProposePresentationHandler'
import type { ProposeProofOptions } from '../v2/interface'

import { Lifecycle, scoped } from 'tsyringe'

import { ConnectionService } from '../../connections'
import { PresentationPreview } from '../PresentationPreview'
import { ProofProtocolVersion } from '../ProofProtocolVersion'
import { ProofService } from '../ProofService'

import { V1LegacyProofService } from './V1LegacyProofService'

/**
 * @todo add method to check if request matches proposal. Useful to see if a request I received is the same as the proposal I sent.
 * @todo add method to reject / revoke messages
 * @todo validate attachments / messages
 */
@scoped(Lifecycle.ContainerScoped)
export class V1ProofService extends ProofService {
  public processProposal(messageContext: HandlerInboundMessage<V2ProposePresentationHandler>): Promise<ProofRecord> {
    throw new Error('Method not implemented.')
  }

  private legacyProofService: V1LegacyProofService

  private connectionService: ConnectionService

  public constructor(proofService: V1LegacyProofService, connectionService: ConnectionService) {
    super()
    this.legacyProofService = proofService
    this.connectionService = connectionService
  }

  public registerHandlers() {
    throw new Error('Method not implemented.')
  }

  public getVersion(): ProofProtocolVersion {
    return ProofProtocolVersion.V1_0
  }

  /**
   * Create a {@link ProposePresentationMessage} not bound to an existing presentation exchange.
   * To create a proposal as response to an existing presentation exchange, use {@link ProofService.createProposalAsResponse}.
   *
   * @param connectionRecord The connection for which to create the presentation proposal
   * @param presentationProposal The presentation proposal to include in the message
   * @param config Additional configuration to use for the proposal
   * @returns Object containing proposal message and associated proof record
   *
   */
  public async createProposal(
    proposal: ProposeProofOptions
  ): Promise<{ proofRecord: ProofRecord; message: AgentMessage }> {
    // Assert
    const connection = await this.connectionService.getById(proposal.connectionId)

    let presentationProposal: PresentationPreview | undefined
    if (proposal?.proofFormats?.indy?.attributes) {
      presentationProposal = new PresentationPreview({
        attributes: proposal?.proofFormats.indy?.attributes,
        predicates: proposal?.proofFormats.indy?.predicates,
      })
    } else {
      presentationProposal = new PresentationPreview({
        attributes: [],
        predicates: [],
      })
    }

    const proposalConfig: PresentationProposalConfig = {
      comment: proposal?.comment,
      autoAcceptProof: proposal?.autoAcceptProof,
    }

    const { message, proofRecord } = await this.legacyProofService.createProposal(
      connection,
      presentationProposal,
      proposalConfig
    )

    return { proofRecord, message }
  }
}

interface PresentationProposalConfig {
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}
