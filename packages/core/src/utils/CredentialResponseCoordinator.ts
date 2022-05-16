import { scoped, Lifecycle } from 'tsyringe'

import { AutoAcceptCredential } from '../modules/credentials/CredentialAutoAcceptType'

/**
 * This class handles all the automation with all the messages in the issue credential protocol
 * Every function returns `true` if it should automate the flow and `false` if not
 */
@scoped(Lifecycle.ContainerScoped)
export class CredentialResponseCoordinator {
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
