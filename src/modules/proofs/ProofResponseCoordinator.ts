import type { ProofRecord } from './repository'

import { scoped, Lifecycle } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { AutoAcceptProof } from '../../types'

/**
 * This class handles all the automation with all the messages in the present proof protocol
 * Every function returns `true` if it should automate the flow and `false` if not
 */
@scoped(Lifecycle.ContainerScoped)
export class ProofResponseCoordinator {
  private agentConfig: AgentConfig

  public constructor(agentConfig: AgentConfig) {
    this.agentConfig = agentConfig
  }

  /**
   * Returns the proof auto accept config based on priority:
   *	- The record config takes first priority
   *	- Otherwise the agent config
   *	- Otherwise {@link AutoAcceptProof.Never} is returned
   *
   * @param recordConfig The auto accept config for the record
   * @param agentConfig The auto accept config for the agent
   * @returns the auto accept config
   */
  private static composeAutoAccept(
    recordConfig: AutoAcceptProof | undefined,
    agentConfig: AutoAcceptProof | undefined
  ) {
    return recordConfig ?? agentConfig ?? AutoAcceptProof.Never
  }

  public shoudlAutoRespondToProposal(proofRecord: ProofRecord) {
    const autoAccept = ProofResponseCoordinator.composeAutoAccept(
      proofRecord.autoAcceptProof,
      this.agentConfig.autoAcceptProofs
    )

    if (autoAccept === AutoAcceptProof.Always) {
      return true
    }
    return false
  }

  /**
   * Checks whether it should automatically respond to a request
   *
   * @param proofRecord The proofrecord that contains the message(s) to respond to
   * @returns a message that will be send to the other agent
   */
  public async shouldAutoRespondToRequest(proofRecord: ProofRecord) {
    const autoAccept = ProofResponseCoordinator.composeAutoAccept(
      proofRecord.autoAcceptProof,
      this.agentConfig.autoAcceptProofs
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
   * Checks whether it should automatically respond to a presention of proof
   *
   * @param proofRecord The proofrecord that contains the message(s) to respond to
   * @returns a message that will be send to the other agent
   */
  public async shouldAutoRespondToPresentation(proofRecord: ProofRecord) {
    const autoAccept = ProofResponseCoordinator.composeAutoAccept(
      proofRecord.autoAcceptProof,
      this.agentConfig.autoAcceptProofs
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
