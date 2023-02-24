/**
 * CheqdModuleConfigOptions defines the interface for the options of the CheqdModuleConfig class.
 */
export interface CheqdModuleConfigOptions {
  networks: INetworkConfig[]
}

export interface INetworkConfig {
  rpcUrl?: string
  cosmosPayerSeed: string
  network: string
}

export class CheqdModuleConfig {
  private options: CheqdModuleConfigOptions

  public constructor(options: CheqdModuleConfigOptions) {
    this.options = options
  }

  /** See {@link CheqdModuleConfigOptions.networks} */
  public get networks() {
    return this.options.networks
  }
}
