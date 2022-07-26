import type { AgentContext } from '../../agent/context'
import type { ProofRecord } from './repository'

import { injectable } from '../../plugins'

import { AutoAcceptProof } from './ProofAutoAcceptType'
import { ProofsModuleConfig } from './ProofsModuleConfig'

/**
 * This class handles all the automation with all the messages in the present proof protocol
 * Every function returns `true` if it should automate the flow and `false` if not
 */
@injectable()
export class ProofResponseCoordinator {
  private proofsModuleConfig: ProofsModuleConfig

  public constructor(proofsModuleConfig: ProofsModuleConfig) {
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

    if (
      autoAccept === AutoAcceptProof.Always ||
      (autoAccept === AutoAcceptProof.ContentApproved && proofRecord.proposalMessage)
    ) {
      return true
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

    if (
      autoAccept === AutoAcceptProof.Always ||
      (autoAccept === AutoAcceptProof.ContentApproved && proofRecord.requestMessage)
    ) {
      return true
    }

    return false
  }
}
