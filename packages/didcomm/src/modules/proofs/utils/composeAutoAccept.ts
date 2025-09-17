import { DidCommAutoAcceptProof } from '../models'

/**
 * Returns the proof auto accept config based on priority:
 *	- The record config takes first priority
 *	- Otherwise the agent config
 *	- Otherwise {@link DidCommAutoAcceptProof.Never} is returned
 */
export function composeAutoAccept(recordConfig?: DidCommAutoAcceptProof, agentConfig?: DidCommAutoAcceptProof) {
  return recordConfig ?? agentConfig ?? DidCommAutoAcceptProof.Never
}
