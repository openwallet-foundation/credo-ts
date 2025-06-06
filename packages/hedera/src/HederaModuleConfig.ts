import { HederaAnoncredsRegistryConfiguration } from '@hiero-did-sdk-js/anoncreds'

export type HederaModuleConfigOptions = HederaAnoncredsRegistryConfiguration

export class HederaModuleConfig {
  private readonly _options: HederaModuleConfigOptions

  public constructor(options: HederaModuleConfigOptions) {
    this._options = options
  }

  get options(): HederaModuleConfigOptions {
    return this._options
  }
}
