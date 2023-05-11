import type { DependencyManager, Module } from '@aries-framework/core'
import type { default as didcomm } from 'didcomm'

// import { DidCommV2EnvelopeServiceToken } from '@aries-framework/core'

import { DIDCommV2LibraryToken, DidCommV2EnvelopeServiceToken, DidCommV2EnvelopeService } from './services'
import { DidCommV2DidResolver } from './services/DidCommV2DidResolver'
import { DidCommV2SecretsResolver } from './services/DidCommV2SecretsResolver'

export interface DidCommV2ModuleParams {
  // Should be passed on of packages:
  //  - NodeJS: `didcomm-node` - https://www.npmjs.com/package/didcomm-node
  //  - React Native - `@sicpa_open_source/didcomm-react-native` - https://www.npmjs.com/package/@sicpa_open_source/didcomm-react-native
  didcomm: typeof didcomm
}

export class DidCommV2Module implements Module {
  private didcomm: typeof didcomm

  /**
   * Registers the dependencies of the didcomm-v2 module on the dependency manager.
   */

  public constructor(props: DidCommV2ModuleParams) {
    this.didcomm = props.didcomm
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerInstance(DIDCommV2LibraryToken, this.didcomm)
    dependencyManager.registerSingleton(DidCommV2EnvelopeServiceToken, DidCommV2EnvelopeService)
    dependencyManager.registerContextScoped(DidCommV2DidResolver)
    dependencyManager.registerContextScoped(DidCommV2SecretsResolver)
  }
}
