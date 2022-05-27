import type { ProofRecord } from './repository'

import { scoped, Lifecycle } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'

import { ProofService } from './ProofService'
import { AutoAcceptProof } from './models/ProofAutoAcceptType'

/**
 * This class handles all the automation with all the messages in the present proof protocol
 * Every function returns `true` if it should automate the flow and `false` if not
 */
@scoped(Lifecycle.ContainerScoped)
export class ProofResponseCoordinator {
  private agentConfig: AgentConfig
  private proofService: ProofService

  public constructor(agentConfig: AgentConfig, proofService: ProofService) {
    this.agentConfig = agentConfig
    this.proofService = proofService
  }

  /**
   * Returns the proof auto accept config based on priority:
   *	- The record config takes first priority
   *	- Otherwise the agent config
   *	- Otherwise {@link AutoAcceptProof.Never} is returned
   */
  private static composeAutoAccept(
    recordConfig: AutoAcceptProof | undefined,
    agentConfig: AutoAcceptProof | undefined
  ) {
    return recordConfig ?? agentConfig ?? AutoAcceptProof.Never
  }

  /**
   * Checks whether it should automatically respond to a proposal
   */
  public shouldAutoRespondToProposal(proofRecord: ProofRecord) {
    const autoAccept = ProofResponseCoordinator.composeAutoAccept(
      proofRecord.autoAcceptProof,
      this.agentConfig.autoAcceptProofs
    )

    if (autoAccept === AutoAcceptProof.Always) {
      return true
    }

    if (autoAccept === AutoAcceptProof.ContentApproved) {
      return this.proofService.shouldAutoRespondToProposal(proofRecord)
    }

    return false
  }

  /**
   * Checks whether it should automatically respond to a request
   */
  public shouldAutoRespondToRequest(proofRecord: ProofRecord) {
    const autoAccept = ProofResponseCoordinator.composeAutoAccept(
      proofRecord.autoAcceptProof,
      this.agentConfig.autoAcceptProofs
    )

    if (autoAccept === AutoAcceptProof.Always) {
      return true
    }

    if (autoAccept === AutoAcceptProof.ContentApproved) {
      return this.proofService.shouldAutoRespondToRequest(proofRecord)
    }

    return false
  }

  /**
   * Checks whether it should automatically respond to a presentation of proof
   */
  public shouldAutoRespondToPresentation(proofRecord: ProofRecord) {
    const autoAccept = ProofResponseCoordinator.composeAutoAccept(
      proofRecord.autoAcceptProof,
      this.agentConfig.autoAcceptProofs
    )

    if (autoAccept === AutoAcceptProof.Always) {
      return true
    }

    if (autoAccept === AutoAcceptProof.ContentApproved) {
      return this.proofService.shouldAutoRespondToPresentation(proofRecord)
    }

    return false
  }
}
