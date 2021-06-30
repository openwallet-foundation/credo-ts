import { AutoAcceptProof } from '../../types'

export class ProofUtils {
  /**
   * Prioritizes the auto accept state and returns the most important auto accept state
   *
   * @param a The auto accept state that has priority
   * @param b The auto accept state that does not have priority
   * @returns the auto accept state
   */
  public static composeAutoAccept(a: AutoAcceptProof | undefined, b: AutoAcceptProof | undefined) {
    return a ? a : b ? b : AutoAcceptProof.never
  }
}
