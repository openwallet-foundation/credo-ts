export interface IndyVdrNetworkConfig {
  indyNamespace: string
  genesisTransaction: string
  isProduction: boolean
}

export interface IndyVdrModuleConfigOptions {
  networks: IndyVdrNetworkConfig[]
}

export class IndyVdrModuleConfig {
  private options: IndyVdrModuleConfigOptions

  public constructor(options: IndyVdrModuleConfigOptions) {
    this.options = options
  }

  public get networkConfigs() {
    return this.options.networks
  }
}
