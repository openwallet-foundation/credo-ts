import { AutoAcceptCredential } from './models'

/**
 * CredentialsModuleConfigOptions defines the interface for the options of the CredentialsModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface CredentialsModuleConfigOptions {
  /**
   * Whether to automatically accept credential messages. Applies to all issue credential protocol versions.
   *
   * @default {@link AutoAcceptCredential.Never}
   */
  autoAcceptCredentials?: AutoAcceptCredential
}

export class CredentialsModuleConfig {
  private options: CredentialsModuleConfigOptions

  public constructor(options?: CredentialsModuleConfigOptions) {
    this.options = options ?? {}
  }

  /** See {@link CredentialsModuleConfigOptions.autoAcceptCredentials} */
  public get autoAcceptCredentials() {
    return this.options.autoAcceptCredentials ?? AutoAcceptCredential.Never
  }
}
