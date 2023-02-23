import type { ProofProtocol } from '../protocol/ProofProtocol'

import { FeatureRegistry } from '../../../agent/FeatureRegistry'
import { DependencyManager } from '../../../plugins/DependencyManager'
import { ProofsApi } from '../ProofsApi'
import { ProofsModule } from '../ProofsModule'
import { ProofsModuleConfig } from '../ProofsModuleConfig'
import { V2ProofProtocol } from '../protocol/v2/V2ProofProtocol'
import { ProofRepository } from '../repository'

jest.mock('../../../plugins/DependencyManager')
jest.mock('../../../agent/FeatureRegistry')

const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>
const dependencyManager = new DependencyManagerMock()
const FeatureRegistryMock = FeatureRegistry as jest.Mock<FeatureRegistry>
const featureRegistry = new FeatureRegistryMock()

describe('ProofsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const proofsModule = new ProofsModule({
      proofProtocols: [],
    })
    proofsModule.register(dependencyManager, featureRegistry)

    expect(dependencyManager.registerContextScoped).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerContextScoped).toHaveBeenCalledWith(ProofsApi)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(ProofsModuleConfig, proofsModule.config)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(ProofRepository)
  })

  test('registers V2ProofProtocol if no proofProtocols are configured', () => {
    const proofsModule = new ProofsModule()

    expect(proofsModule.config.proofProtocols).toEqual([expect.any(V2ProofProtocol)])
  })

  test('calls register on the provided ProofProtocols', () => {
    const registerMock = jest.fn()
    const proofProtocol = {
      register: registerMock,
    } as unknown as ProofProtocol

    const proofsModule = new ProofsModule({
      proofProtocols: [proofProtocol],
    })

    expect(proofsModule.config.proofProtocols).toEqual([proofProtocol])

    proofsModule.register(dependencyManager, featureRegistry)

    expect(registerMock).toHaveBeenCalledTimes(1)
    expect(registerMock).toHaveBeenCalledWith(dependencyManager, featureRegistry)
  })
})
