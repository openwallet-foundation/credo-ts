import { AutoAcceptProof } from './ProofAutoAcceptType'

/**
 * ProofsModuleConfigOptions defines the interface for the options of the ProofsModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface ProofsModuleConfigOptions {
  /**
   * Whether to automatically accept proof messages. Applies to all present proof protocol versions.
   *
   * @default {@link AutoAcceptProof.Never}
   */
  autoAcceptProofs?: AutoAcceptProof
}

export class ProofsModuleConfig {
  private options: ProofsModuleConfigOptions

  public constructor(options?: ProofsModuleConfigOptions) {
    this.options = options ?? {}
  }

  /** See {@link ProofsModuleConfigOptions.autoAcceptProofs} */
  public get autoAcceptProofs() {
    return this.options.autoAcceptProofs ?? AutoAcceptProof.Never
  }
}
