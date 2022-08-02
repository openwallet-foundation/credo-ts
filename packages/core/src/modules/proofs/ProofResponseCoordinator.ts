import type { AgentContext } from '../../agent/context'
import type { ProofRecord } from './repository'

import { AgentConfig } from '../../agent/AgentConfig'
import { injectable } from '../../plugins'

import { ProofService } from './ProofService'
import { ProofsModuleConfig } from './ProofsModuleConfig'
import { AutoAcceptProof } from './models/ProofAutoAcceptType'

/**
 * This class handles all the automation with all the messages in the present proof protocol
 * Every function returns `true` if it should automate the flow and `false` if not
 */
@injectable()
export class ProofResponseCoordinator {
  private agentConfig: AgentConfig
  private proofService: ProofService
  private proofsModuleConfig: ProofsModuleConfig

  public constructor(agentConfig: AgentConfig, proofService: ProofService, proofsModuleConfig: ProofsModuleConfig) {
    this.agentConfig = agentConfig
    this.proofService = proofService
    this.proofsModuleConfig = proofsModuleConfig
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
  public shouldAutoRespondToProposal(agentContext: AgentContext, proofRecord: ProofRecord) {
    const autoAccept = ProofResponseCoordinator.composeAutoAccept(
      proofRecord.autoAcceptProof,
      this.proofsModuleConfig.autoAcceptProofs
    )

    if (autoAccept === AutoAcceptProof.Always) {
      return true
    }

    if (autoAccept === AutoAcceptProof.ContentApproved) {
      return this.proofService.shouldAutoRespondToProposal(agentContext, proofRecord)
    }

    return false
  }

  /**
   * Checks whether it should automatically respond to a request
   */
  public shouldAutoRespondToRequest(agentContext: AgentContext, proofRecord: ProofRecord) {
    const autoAccept = ProofResponseCoordinator.composeAutoAccept(
      proofRecord.autoAcceptProof,
      this.proofsModuleConfig.autoAcceptProofs
    )

    if (autoAccept === AutoAcceptProof.Always) {
      return true
    }

    if (autoAccept === AutoAcceptProof.ContentApproved) {
      return this.proofService.shouldAutoRespondToRequest(agentContext, proofRecord)
    }

    return false
  }

  /**
   * Checks whether it should automatically respond to a presentation of proof
   */
  public shouldAutoRespondToPresentation(agentContext: AgentContext, proofRecord: ProofRecord) {
    const autoAccept = ProofResponseCoordinator.composeAutoAccept(
      proofRecord.autoAcceptProof,
      this.proofsModuleConfig.autoAcceptProofs
    )

    if (autoAccept === AutoAcceptProof.Always) {
      return true
    }

    if (autoAccept === AutoAcceptProof.ContentApproved) {
      return this.proofService.shouldAutoRespondToPresentation(agentContext, proofRecord)
    }

    return false
  }
}
