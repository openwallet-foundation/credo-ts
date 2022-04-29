import type { ValueTransferRecord } from './repository'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'

import { AutoAcceptValueTransfer } from './ValueTransferAutoAcceptType'

/**
 * This class handles all the automation with all the messages in the value transfer protocol
 * Every function returns `true` if it should automate the flow and `false` if not
 */
@scoped(Lifecycle.ContainerScoped)
export class ValueTransferResponseCoordinator {
  private agentConfig: AgentConfig

  public constructor(agentConfig: AgentConfig) {
    this.agentConfig = agentConfig
  }

  /**
   * Checks whether it should automatically respond to a request
   */
  public shouldAutoRespondToRequest(valueTransferRecord: ValueTransferRecord) {
    const autoAccept =
      valueTransferRecord.autoAcceptValueTransfer ??
      this.agentConfig.autoAcceptValueTransfer ??
      AutoAcceptValueTransfer.Never

    return autoAccept === AutoAcceptValueTransfer.Always
  }
}
