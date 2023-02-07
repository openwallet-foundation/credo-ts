import type { AriesAskar } from './types'

/**
 * AskarModuleConfigOptions defines the interface for the options of the AskarModuleConfig class.
 */
export interface AskarModuleConfigOptions {
  /**
   * Implementation of the Askar interface according to aries-askar JavaScript wrapper.
   *
   *
   * ## Node.JS
   *
   * ```ts
   * import { NodeJSAriesAskar } from 'aries-askar-nodejs'
   *
   * const askarModule = new AskarModule({
   *   askar: new NodeJSAriesAskar()
   * })
   * ```
   *
   * ## React Native
   *
   * ```ts
   * import { ReactNativeAriesAskar } from 'aries-askar-react-native'
   *
   * const askarModule = new AskarModule({
   *   askar: new ReactNativeAriesAskar()
   * })
   * ```
   */
  askar: AriesAskar
}

export class AskarModuleConfig {
  private options: AskarModuleConfigOptions

  public constructor(options: AskarModuleConfigOptions) {
    this.options = options
  }

  public get askar() {
    return this.options.askar
  }
}
