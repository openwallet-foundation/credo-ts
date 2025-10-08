import { type Cache } from '@hiero-did-sdk/core'
import { type HederaHcsServiceConfiguration } from '@hiero-did-sdk/hcs'

export interface HederaModuleConfigOptions extends HederaHcsServiceConfiguration {
  cache?: Cache
}

export class HederaModuleConfig {
  public readonly options: HederaModuleConfigOptions

  public constructor(options: HederaModuleConfigOptions) {
    this.options = options
  }
}
