import { DidsModuleConfig } from '@credo-ts/core'
import { CheqdDidResolver } from '../src/dids/CheqdDidResolver'

describe('CheqdDidResolver', () => {
  it('declares global caching without core method defaults', () => {
    const resolver = new CheqdDidResolver()
    const config = new DidsModuleConfig({ resolvers: [resolver] })

    expect(resolver.allowsCaching).toBe(true)
    expect(resolver.cacheScope).toBe('global')
    expect(config.getCacheScope('cheqd')).toBe('global')
  })
})
