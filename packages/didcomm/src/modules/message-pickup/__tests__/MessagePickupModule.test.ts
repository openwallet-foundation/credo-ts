import type { DependencyManager } from '../../../../../core/src/plugins'
import type { MessagePickupProtocol } from '../protocol/MessagePickupProtocol'

import { MessageHandlerRegistry } from '../../..//MessageHandlerRegistry'
import { InjectionSymbols } from '../../../../../core'
import { getAgentContext } from '../../../../../core/tests'
import { FeatureRegistry } from '../../../FeatureRegistry'
import { MessagePickupModule } from '../MessagePickupModule'
import { MessagePickupModuleConfig } from '../MessagePickupModuleConfig'
import { MessagePickupSessionService } from '../services'
import { InMemoryMessagePickupRepository } from '../storage'

describe('MessagePickupModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const dependencyManager = {
      registerInstance: jest.fn(),
      registerSingleton: jest.fn(),
      isRegistered: () => {
        return false
      },
    } as unknown as DependencyManager

    const module = new MessagePickupModule()
    module.register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(MessagePickupModuleConfig, module.config)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(
      InjectionSymbols.MessagePickupRepository,
      InMemoryMessagePickupRepository
    )
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(MessagePickupSessionService)
  })

  test('calls register on the provided ProofProtocols', async () => {
    const messagePickupProtocol = {
      register: jest.fn(),
    } as unknown as MessagePickupProtocol

    const messagePickupModule = new MessagePickupModule({
      protocols: [messagePickupProtocol],
    })

    expect(messagePickupModule.config.protocols).toEqual([messagePickupProtocol])

    const messagePickupSessionSessionService = {
      start: jest.fn(),
    } as unknown as MessagePickupSessionService

    const messageHandlerRegistry = new MessageHandlerRegistry()
    const featureRegistry = new FeatureRegistry()

    const agentContext = getAgentContext({
      registerInstances: [
        [MessagePickupSessionService, messagePickupSessionSessionService],
        [MessageHandlerRegistry, messageHandlerRegistry],
        [FeatureRegistry, featureRegistry],
      ],
    })
    await messagePickupModule.initialize(agentContext)

    expect(messagePickupProtocol.register).toHaveBeenCalledTimes(1)
    expect(messagePickupProtocol.register).toHaveBeenCalledWith(messageHandlerRegistry, featureRegistry)

    expect(messagePickupSessionSessionService.start).toHaveBeenCalledTimes(1)

    // TODO: add test in each protocol to verify that it is properly registered in the feature registry
  })
})
