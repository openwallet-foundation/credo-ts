import { AutoAcceptCredential } from './models'

/**
 * CredentialsModuleConfigOptions defines the interface for the options of the CredentialsModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface CredentialsModuleConfigOptions {
  autoAcceptCredentials: AutoAcceptCredential
}

export class CredentialsModuleConfig {
  private options: CredentialsModuleConfigOptions

  public constructor(options: CredentialsModuleConfigOptions) {
    this.options = options
  }

  public get autoAcceptCredentials() {
    return this.options.autoAcceptCredentials ?? AutoAcceptCredential.Never
  }
}
