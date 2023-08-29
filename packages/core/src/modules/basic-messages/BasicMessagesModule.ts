import type { BasicMessagesModuleConfigOptions } from './BasicMessagesModuleConfig'
import type { BasicMessageProtocol } from './protocols/BasicMessageProtocol'
import type { FeatureRegistry } from '../../agent/FeatureRegistry'
import type { ApiModule, DependencyManager } from '../../plugins'
import type { Optional } from '../../utils'
import type { Constructor } from '../../utils/mixins'

import { BasicMessagesApi } from './BasicMessagesApi'
import { BasicMessagesModuleConfig } from './BasicMessagesModuleConfig'
import { V1BasicMessageProtocol, V2BasicMessageProtocol } from './protocols'
import { BasicMessageRepository } from './repository'

/**
 * Default basicMessageProtocols that will be registered if the `basicMessageProtocols` property is not configured.
 */
export type DefaultBasicMessageProtocols = []

// BasicMessagesModuleOptions makes the credentialProtocols property optional from the config, as it will set it when not provided.
export type BasicMessagesModuleOptions<BasicMessagesProtocols extends BasicMessageProtocol[]> = Optional<
  BasicMessagesModuleConfigOptions<BasicMessagesProtocols>,
  'basicMessageProtocols'
>

export class BasicMessagesModule<BasicMessageProtocols extends BasicMessageProtocol[] = DefaultBasicMessageProtocols>
  implements ApiModule
{
  public readonly config: BasicMessagesModuleConfig<BasicMessageProtocols>

  public readonly api: Constructor<BasicMessagesApi<BasicMessageProtocols>> = BasicMessagesApi

  public constructor(config?: BasicMessagesModuleConfig<BasicMessageProtocols>) {
    this.config = new BasicMessagesModuleConfig({
      ...config,
      basicMessageProtocols: config?.basicMessageProtocols ?? [
        new V1BasicMessageProtocol(),
        new V2BasicMessageProtocol(),
      ],
    } as BasicMessagesModuleConfig<BasicMessageProtocols>)
  }

  /**
   * Registers the dependencies of the basic message module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Api
    dependencyManager.registerContextScoped(BasicMessagesApi)

    // Config
    dependencyManager.registerInstance(BasicMessagesModuleConfig, this.config)

    // Repositories
    dependencyManager.registerSingleton(BasicMessageRepository)

    // Protocol needs to register feature registry items and handlers
    for (const basicMessageProtocols of this.config.basicMessageProtocols) {
      basicMessageProtocols.register(dependencyManager, featureRegistry)
    }
  }
}
