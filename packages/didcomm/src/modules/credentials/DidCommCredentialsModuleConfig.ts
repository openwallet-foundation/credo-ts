import type { DidCommCredentialProtocol } from './protocol/DidCommCredentialProtocol'

import { DidCommAutoAcceptCredential } from './models'

/**
 * CredentialsModuleConfigOptions defines the interface for the options of the CredentialsModuleConfig class.
 * This can contain optional parameters that have default values in the config class itself.
 */
export interface DidCommCredentialsModuleConfigOptions<CredentialProtocols extends DidCommCredentialProtocol[]> {
  /**
   * Whether to automatically accept credential messages. Applies to all issue credential protocol versions.
   *
   * @default {@link DidCommAutoAcceptCredential.Never}
   */
  autoAcceptCredentials?: DidCommAutoAcceptCredential

  /**
   * Credential protocols to make available to the credentials module. Only one credential protocol should be registered for each credential
   * protocol version.
   *
   * When not provided, the `DidCommCredentialV2Protocol` is registered by default.
   *
   * @default
   * ```
   * [DidCommCredentialV2Protocol]
   * ```
   */
  credentialProtocols: CredentialProtocols
}

export class DidCommCredentialsModuleConfig<CredentialProtocols extends DidCommCredentialProtocol[]> {
  private options: DidCommCredentialsModuleConfigOptions<CredentialProtocols>

  public constructor(options: DidCommCredentialsModuleConfigOptions<CredentialProtocols>) {
    this.options = options
  }

  /** See {@link DidCommCredentialsModuleConfigOptions.autoAcceptCredentials} */
  public get autoAcceptCredentials() {
    return this.options.autoAcceptCredentials ?? DidCommAutoAcceptCredential.Never
  }

  /** See {@link DidCommCredentialsModuleConfigOptions.credentialProtocols} */
  public get credentialProtocols() {
    return this.options.credentialProtocols
  }
}
