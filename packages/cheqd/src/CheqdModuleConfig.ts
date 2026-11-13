/**
 * CheqdModuleConfigOptions defines the interface for the options of the CheqdModuleConfig class.
 */
export interface CheqdModuleConfigOptions {
  networks: NetworkConfig[]
}

export interface NetworkConfig {
  rpcUrl?: string
  /** Pays for ledger writes. On React Native, a mnemonic needs a full WebCrypto implementation such as `react-native-quick-crypto`. */
  cosmosPayerSeed?: string
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
