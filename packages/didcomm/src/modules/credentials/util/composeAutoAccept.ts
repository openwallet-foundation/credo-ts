import { DidCommAutoAcceptCredential } from '../models/DidCommCredentialAutoAcceptType'

/**
 * Returns the credential auto accept config based on priority:
 *	- The record config takes first priority
 *	- Otherwise the agent config
 *	- Otherwise {@link DidCommAutoAcceptCredential.Never} is returned
 */
export function composeAutoAccept(
  recordConfig: DidCommAutoAcceptCredential | undefined,
  agentConfig: DidCommAutoAcceptCredential | undefined
) {
  return recordConfig ?? agentConfig ?? DidCommAutoAcceptCredential.Never
}
