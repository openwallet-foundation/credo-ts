/**
 * CheqdSdkModuleConfigOptions defines the interface for the options of the CheqdSdkModuleConfig class.
 */
export interface CheqdSdkModuleConfigOptions {
  rpcUrl?: string
  cosmosPayerSeed: string
}

export class CheqdSdkModuleConfig {
  private options: CheqdSdkModuleConfigOptions

  public constructor(options: CheqdSdkModuleConfigOptions) {
    this.options = options
  }

  /** See {@link CheqdSdkModuleConfigOptions.rpcUrl} */
  public get rpcUrl() {
    return this.options.rpcUrl
  }

  /** See {@link CheqdSdkModuleConfigOptions.cosmosPayerSeed} */
  public get cosmosPayerSeed() {
    return this.options.cosmosPayerSeed
  }
}
