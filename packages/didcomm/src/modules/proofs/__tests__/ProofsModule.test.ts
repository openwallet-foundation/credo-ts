import type { DependencyManager } from '../../../../../core'
import type { ProofProtocol } from '../protocol/ProofProtocol'

import { getAgentContext } from '../../../../../core/tests'
import { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../../DidCommMessageHandlerRegistry'
import { ProofsModule } from '../ProofsModule'
import { ProofsModuleConfig } from '../ProofsModuleConfig'
import { V2ProofProtocol } from '../protocol/v2/V2ProofProtocol'
import { ProofRepository } from '../repository'

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  registerContextScoped: jest.fn(),
} as unknown as DependencyManager

describe('ProofsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const proofsModule = new ProofsModule({
      proofProtocols: [],
    })
    proofsModule.register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(ProofsModuleConfig, proofsModule.config)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(ProofRepository)
  })

  test('registers V2ProofProtocol if no proofProtocols are configured', () => {
    const proofsModule = new ProofsModule()

    expect(proofsModule.config.proofProtocols).toEqual([expect.any(V2ProofProtocol)])
  })

  test('calls register on the provided ProofProtocols', async () => {
    const registerMock = jest.fn()
    const proofProtocol = {
      register: registerMock,
    } as unknown as ProofProtocol

    const proofsModule = new ProofsModule({
      proofProtocols: [proofProtocol],
    })

    expect(proofsModule.config.proofProtocols).toEqual([proofProtocol])

    const featureRegistry = new DidCommFeatureRegistry()
    const messageHandlerRegistry = new DidCommMessageHandlerRegistry()
    const agentContext = getAgentContext({
      registerInstances: [
        [DidCommMessageHandlerRegistry, messageHandlerRegistry],
        [DidCommFeatureRegistry, featureRegistry],
      ],
    })
    await proofsModule.initialize(agentContext)

    expect(registerMock).toHaveBeenCalledTimes(1)
    expect(registerMock).toHaveBeenCalledWith(messageHandlerRegistry, featureRegistry)
  })
})
