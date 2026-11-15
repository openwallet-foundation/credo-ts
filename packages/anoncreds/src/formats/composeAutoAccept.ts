import { DidCommAutoAcceptCredential, DidCommAutoAcceptProof } from '@credo-ts/didcomm'

/**
 * Returns the credential auto accept config based on priority:
 *	- The record config takes first priority
 *	- Otherwise the agent config
 *	- Otherwise {@link DidCommAutoAcceptCredential.Never} is returned
 */
export function composeCredentialAutoAccept(
  recordConfig?: DidCommAutoAcceptCredential,
  agentConfig?: DidCommAutoAcceptCredential
) {
  return recordConfig ?? agentConfig ?? DidCommAutoAcceptCredential.Never
}

/**
 * Returns the proof auto accept config based on priority:
 *	- The record config takes first priority
 *	- Otherwise the agent config
 *	- Otherwise {@link DidCommAutoAcceptProof.Never} is returned
 */
export function composeProofAutoAccept(recordConfig?: DidCommAutoAcceptProof, agentConfig?: DidCommAutoAcceptProof) {
  return recordConfig ?? agentConfig ?? DidCommAutoAcceptProof.Never
}
