import type { DependencyManager } from '../../../../../core'
import type { DidCommProofProtocol } from '../protocol/DidCommProofProtocol'

import { getAgentContext } from '../../../../../core/tests'
import { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../../DidCommMessageHandlerRegistry'
import { DidCommProofsModule } from '../DidCommProofsModule'
import { DidCommProofsModuleConfig } from '../DidCommProofsModuleConfig'
import { V2DidCommProofProtocol } from '../protocol/v2/DidCommProofV2Protocol'
import { DidCommProofExchangeRepository } from '../repository'

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  registerContextScoped: jest.fn(),
} as unknown as DependencyManager

describe('DidCommProofsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const proofsModule = new DidCommProofsModule({
      proofProtocols: [],
    })
    proofsModule.register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(DidCommProofsModuleConfig, proofsModule.config)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommProofExchangeRepository)
  })

  test('registers V2DidCommProofProtocol if no proofProtocols are configured', () => {
    const proofsModule = new DidCommProofsModule()

    expect(proofsModule.config.proofProtocols).toEqual([expect.any(V2DidCommProofProtocol)])
  })

  test('calls register on the provided ProofProtocols', async () => {
    const registerMock = jest.fn()
    const proofProtocol = {
      register: registerMock,
    } as unknown as DidCommProofProtocol

    const proofsModule = new DidCommProofsModule({
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
