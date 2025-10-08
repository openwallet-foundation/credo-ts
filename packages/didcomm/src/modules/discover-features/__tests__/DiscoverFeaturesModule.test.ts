import type { DependencyManager } from '../../../../../core'

import { getAgentContext } from '../../../../../core/tests'
import { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import { DidCommProtocol } from '../../../models'
import { DidCommDiscoverFeaturesModule } from '../DidCommDiscoverFeaturesModule'
import { DidCommDiscoverFeaturesV1Service } from '../protocol/v1'
import { DidCommDiscoverFeaturesV2Service } from '../protocol/v2'

describe('DiscoverFeaturesModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const dependencyManager = {
      registerInstance: vi.fn(),
      registerSingleton: vi.fn(),
      registerContextScoped: vi.fn(),
    } as unknown as DependencyManager

    new DidCommDiscoverFeaturesModule().register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommDiscoverFeaturesV1Service)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommDiscoverFeaturesV2Service)
  })

  test('registers features on the feature registry', async () => {
    const featureRegistry = new DidCommFeatureRegistry()
    const agentContext = getAgentContext({ registerInstances: [[DidCommFeatureRegistry, featureRegistry]] })
    await new DidCommDiscoverFeaturesModule().initialize(agentContext)

    expect(featureRegistry.query({ featureType: 'protocol', match: '*' })).toEqual([
      new DidCommProtocol({
        id: 'https://didcomm.org/discover-features/1.0',
        roles: ['requester', 'responder'],
      }),
      new DidCommProtocol({
        id: 'https://didcomm.org/discover-features/2.0',
        roles: ['requester', 'responder'],
      }),
    ])
  })
})
