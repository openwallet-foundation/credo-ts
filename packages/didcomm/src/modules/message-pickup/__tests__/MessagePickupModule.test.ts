import type { DependencyManager } from '../../../../../core/src/plugins'
import type { DidCommMessagePickupProtocol } from '../protocol/DidCommMessagePickupProtocol'

import { getAgentContext } from '../../../../../core/tests'
import { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../../DidCommMessageHandlerRegistry'
import { DidCommMessagePickupModule } from '../DidCommMessagePickupModule'
import { DidCommMessagePickupModuleConfig } from '../DidCommMessagePickupModuleConfig'
import { DidCommMessagePickupSessionService } from '../services'

describe('DidCommMessagePickupModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const dependencyManager = {
      registerInstance: vi.fn(),
      registerSingleton: vi.fn(),
      isRegistered: () => {
        return false
      },
    } as unknown as DependencyManager

    const module = new DidCommMessagePickupModule()
    module.register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(DidCommMessagePickupModuleConfig, module.config)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommMessagePickupSessionService)
  })

  test('calls register on the provided ProofProtocols', async () => {
    const messagePickupProtocol = {
      register: vi.fn(),
    } as unknown as DidCommMessagePickupProtocol

    const messagePickupModule = new DidCommMessagePickupModule({
      protocols: [messagePickupProtocol],
    })

    expect(messagePickupModule.config.protocols).toEqual([messagePickupProtocol])

    const messagePickupSessionSessionService = {
      start: vi.fn(),
    } as unknown as DidCommMessagePickupSessionService

    const messageHandlerRegistry = new DidCommMessageHandlerRegistry()
    const featureRegistry = new DidCommFeatureRegistry()

    const agentContext = getAgentContext({
      registerInstances: [
        [DidCommMessagePickupSessionService, messagePickupSessionSessionService],
        [DidCommMessageHandlerRegistry, messageHandlerRegistry],
        [DidCommFeatureRegistry, featureRegistry],
      ],
    })
    await messagePickupModule.initialize(agentContext)

    expect(messagePickupProtocol.register).toHaveBeenCalledTimes(1)
    expect(messagePickupProtocol.register).toHaveBeenCalledWith(messageHandlerRegistry, featureRegistry)

    expect(messagePickupSessionSessionService.start).not.toHaveBeenCalled()

    await messagePickupModule.onInitializeContext(agentContext)
    expect(messagePickupSessionSessionService.start).toHaveBeenCalledTimes(1)

    // TODO: add test in each protocol to verify that it is properly registered in the feature registry
  })
})
