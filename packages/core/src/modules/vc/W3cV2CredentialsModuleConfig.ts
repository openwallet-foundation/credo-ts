export interface W3cV2CredentialsModuleConfigOptions {
  dataIntegrity?: {
    recompactInvalidContexts?: boolean
  }
}

export class W3cV2CredentialsModuleConfig {
  private options: W3cV2CredentialsModuleConfigOptions

  public constructor(options?: W3cV2CredentialsModuleConfigOptions) {
    this.options = options ?? {}
  }

  public get recompactInvalidContexts() {
    return this.options.dataIntegrity?.recompactInvalidContexts ?? true
  }
}
