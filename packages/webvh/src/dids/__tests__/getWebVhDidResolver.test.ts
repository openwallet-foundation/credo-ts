import { DependencyManager, DidsModule, DidsModuleConfig } from '@credo-ts/core'

import { getAgentContext } from '../../../../core/tests/helpers'
import { WebVhModule } from '../../WebVhModule'
import { getWebVhDidResolver } from '../getWebVhDidResolver'
import { WebVhDidResolver } from '../WebVhDidResolver'

function registerModules(didsModule: DidsModule) {
  const dependencyManager = new DependencyManager()
  dependencyManager.registerModules({ dids: didsModule, webvh: new WebVhModule() })
  return getAgentContext({ dependencyManager })
}

describe('getWebVhDidResolver', () => {
  test('returns the resolver configured on the DidsModule', () => {
    const resolver = new WebVhDidResolver({ maxResourceBytes: 1024 })
    const agentContext = registerModules(new DidsModule({ resolvers: [resolver] }))

    expect(getWebVhDidResolver(agentContext)).toBe(resolver)
    expect(agentContext.resolve(DidsModuleConfig).resolvers.filter((r) => r instanceof WebVhDidResolver)).toHaveLength(
      1
    )
  })

  test('returns the resolver the WebVhModule adds when the DidsModule has none', () => {
    const agentContext = registerModules(new DidsModule())

    const resolver = getWebVhDidResolver(agentContext)
    expect(agentContext.resolve(DidsModuleConfig).resolvers).toContain(resolver)
  })

  test('throws when no WebVhDidResolver is registered', () => {
    const agentContext = getAgentContext({ registerInstances: [[DidsModuleConfig, new DidsModuleConfig()]] })

    expect(() => getWebVhDidResolver(agentContext)).toThrow('No WebVhDidResolver registered on the DidsModule')
  })
})
