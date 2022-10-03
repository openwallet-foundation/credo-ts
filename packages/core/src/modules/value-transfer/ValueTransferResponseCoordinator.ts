import { AgentConfig } from '../../agent/AgentConfig'
import { injectable } from '../../plugins'

import { AutoAcceptValueTransfer } from './ValueTransferAutoAcceptType'

/**
 * This class handles all the automation with all the messages in the value transfer protocol
 * Every function returns `true` if it should automate the flow and `false` if not
 */
@injectable()
export class ValueTransferResponseCoordinator {
  private agentConfig: AgentConfig

  public constructor(agentConfig: AgentConfig) {
    this.agentConfig = agentConfig
  }

  /**
   * Checks whether it should automatically respond to a request
   */
  public shouldAutoRespondToRequest() {
    const autoAccept = this.agentConfig.autoAcceptPaymentRequest ?? AutoAcceptValueTransfer.Never

    return autoAccept === AutoAcceptValueTransfer.Always
  }

  /**
   * Checks whether it should automatically respond to a offer
   */
  public shouldAutoRespondToOffer() {
    const autoAccept = this.agentConfig.autoAcceptPaymentOffer ?? AutoAcceptValueTransfer.Never

    return autoAccept === AutoAcceptValueTransfer.Always
  }

  /**
   * Checks whether it should automatically respond to a request send in respponse on offer
   */
  public shouldAutoRespondToOfferedRequest() {
    const autoAccept = this.agentConfig.autoAcceptOfferedPaymentRequest ?? AutoAcceptValueTransfer.Never

    return autoAccept === AutoAcceptValueTransfer.Always
  }
}
