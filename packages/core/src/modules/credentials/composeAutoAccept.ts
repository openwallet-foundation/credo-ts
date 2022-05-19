/**
 * Returns the credential auto accept config based on priority:
 *	- The record config takes first priority
 *	- Otherwise the agent config
 *	- Otherwise {@link AutoAcceptCredential.Never} is returned
 */

import { AutoAcceptCredential } from './CredentialAutoAcceptType'

export function composeAutoAccept(
  recordConfig: AutoAcceptCredential | undefined,
  agentConfig: AutoAcceptCredential | undefined
) {
  return recordConfig ?? agentConfig ?? AutoAcceptCredential.Never
}
