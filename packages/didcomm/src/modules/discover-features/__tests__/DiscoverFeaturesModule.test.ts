import type { DependencyManager } from '../../../../../core'

import { getAgentContext } from '../../../../../core/tests'
import { FeatureRegistry } from '../../../FeatureRegistry'
import { Protocol } from '../../../models'
import { DiscoverFeaturesModule } from '../DiscoverFeaturesModule'
import { V1DiscoverFeaturesService } from '../protocol/v1'
import { V2DiscoverFeaturesService } from '../protocol/v2'

describe('DiscoverFeaturesModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const dependencyManager = {
      registerInstance: jest.fn(),
      registerSingleton: jest.fn(),
      registerContextScoped: jest.fn(),
    } as unknown as DependencyManager

    new DiscoverFeaturesModule().register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V1DiscoverFeaturesService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(V2DiscoverFeaturesService)
  })

  test('registers features on the feature registry', async () => {
    const featureRegistry = new FeatureRegistry()
    const agentContext = getAgentContext({ registerInstances: [[FeatureRegistry, featureRegistry]] })
    await new DiscoverFeaturesModule().initialize(agentContext)

    expect(featureRegistry.query({ featureType: 'protocol', match: '*' })).toEqual([
      new Protocol({
        id: 'https://didcomm.org/discover-features/1.0',
        roles: ['requester', 'responder'],
      }),
      new Protocol({
        id: 'https://didcomm.org/discover-features/2.0',
        roles: ['requester', 'responder'],
      }),
    ])
  })
})
