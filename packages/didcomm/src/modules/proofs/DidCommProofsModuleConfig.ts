import type { DidCommProofProtocol } from './protocol/DidCommProofProtocol'

import { DidCommAutoAcceptProof } from './models/DidCommProofAutoAcceptType'

/**
 * ProofsModuleConfigOptions defines the interface for the options of the ProofsModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface DidCommProofsModuleConfigOptions<ProofProtocols extends DidCommProofProtocol[]> {
  /**
   * Whether to automatically accept proof messages. Applies to all present proof protocol versions.
   *
   * @default {@link DidCommAutoAcceptProof.Never}
   */
  autoAcceptProofs?: DidCommAutoAcceptProof

  /**
   * Proof protocols to make available to the proofs module. Only one proof protocol should be registered for each proof
   * protocol version.
   *
   * When not provided, the `V2DidCommProofProtocol` is registered by default.
   *
   * @default
   * ```
   * [V2DidCommProofProtocol]
   * ```
   */
  proofProtocols: ProofProtocols
}

export class DidCommProofsModuleConfig<ProofProtocols extends DidCommProofProtocol[]> {
  private options: DidCommProofsModuleConfigOptions<ProofProtocols>

  public constructor(options: DidCommProofsModuleConfigOptions<ProofProtocols>) {
    this.options = options
  }

  /** See {@link DidCommProofsModuleConfigOptions.autoAcceptProofs} */
  public get autoAcceptProofs() {
    return this.options.autoAcceptProofs ?? DidCommAutoAcceptProof.Never
  }

  /** See {@link DidCommProofsModuleConfigOptions.proofProtocols} */
  public get proofProtocols() {
    return this.options.proofProtocols
  }
}
