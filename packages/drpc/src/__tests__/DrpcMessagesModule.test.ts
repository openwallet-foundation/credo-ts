import type { DependencyManager } from '../../../core/src/plugins/DependencyManager'

import { FeatureRegistry, Protocol } from '@credo-ts/didcomm'

import { getAgentConfig, getAgentContext } from '../../../core/tests'
import { DrpcModule } from '../DrpcModule'
import { DrpcRole } from '../models'
import { DrpcRepository } from '../repository'
import { DrpcService } from '../services'

describe('DrpcModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const dependencyManager = {
      registerInstance: jest.fn(),
      registerSingleton: jest.fn(),
      registerContextScoped: jest.fn(),
      resolve: () => {
        return getAgentConfig('dprc')
      },
    } as unknown as DependencyManager

    new DrpcModule().register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DrpcService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DrpcRepository)
  })

  test('registers features on the feature registry', async () => {
    const featureRegistry = new FeatureRegistry()
    const agentContext = getAgentContext({ registerInstances: [[FeatureRegistry, featureRegistry]] })
    await new DrpcModule().initialize(agentContext)

    expect(featureRegistry.query({ featureType: 'protocol', match: '*' })).toEqual([
      new Protocol({
        id: 'https://didcomm.org/drpc/1.0',
        roles: [DrpcRole.Client, DrpcRole.Server],
      }),
    ])
  })
})
