import type {
  V1IssueCredentialMessage,
  V1OfferCredentialMessage,
  V1ProposeCredentialMessage,
  V1RequestCredentialMessage,
} from './protocol/v1/messages'
import type { CredentialExchangeRecord } from './repository'

import { scoped, Lifecycle } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { DidCommMessageRepository } from '../../storage'

import { AutoAcceptCredential } from './CredentialAutoAcceptType'
import { CredentialUtils } from './CredentialUtils'

/**
 * This class handles all the automation with all the messages in the issue credential protocol
 * Every function returns `true` if it should automate the flow and `false` if not
 */
@scoped(Lifecycle.ContainerScoped)
export class CredentialResponseCoordinator {
  private agentConfig: AgentConfig
  private didCommMessageRepository: DidCommMessageRepository

  public constructor(agentConfig: AgentConfig, didCommMessageRepository: DidCommMessageRepository) {
    this.agentConfig = agentConfig
    this.didCommMessageRepository = didCommMessageRepository
  }

  /**
   * Returns the credential auto accept config based on priority:
   *	- The record config takes first priority
   *	- Otherwise the agent config
   *	- Otherwise {@link AutoAcceptCredential.Never} is returned
   */
  public static composeAutoAccept(
    recordConfig: AutoAcceptCredential | undefined,
    agentConfig: AutoAcceptCredential | undefined
  ) {
    return recordConfig ?? agentConfig ?? AutoAcceptCredential.Never
  }
}
