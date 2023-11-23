import type { IInMemoryVerifierSessionManager } from './InMemoryVerifierSessionManager'

export interface OpenId4VcVerifierModuleConfigOptions {
  sessionManager?: IInMemoryVerifierSessionManager
}

export class OpenId4VcVerifierModuleConfig {
  private options: OpenId4VcVerifierModuleConfigOptions

  public constructor(options: OpenId4VcVerifierModuleConfigOptions) {
    this.options = options
  }

  public get sessionManager() {
    return this.options.sessionManager
  }
}
