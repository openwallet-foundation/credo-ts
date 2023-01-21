import type { Anoncreds } from './types'

/**
 * AskarModuleConfigOptions defines the interface for the options of the AskarModuleConfig class.
 */
export interface AnonCredsRsModuleConfigOptions {
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
  lib: Anoncreds
}

export class AnonCredsRsModuleConfig {
  private options: AnonCredsRsModuleConfigOptions

  public constructor(options: AnonCredsRsModuleConfigOptions) {
    this.options = options
  }

  public get lib() {
    return this.options.lib
  }
}
