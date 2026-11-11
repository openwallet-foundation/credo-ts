import { DidsModuleConfig } from '@credo-ts/core'
import { CheqdDidResolver } from '../src/dids/CheqdDidResolver'

describe('CheqdDidResolver', () => {
  it('uses global caching by default and supports context scope configuration', () => {
    const resolver = new CheqdDidResolver()
    const config = new DidsModuleConfig({ resolvers: [resolver] })

    expect(resolver.allowsCaching).toBe(true)
    expect(config.getCacheScope('cheqd')).toBe('global')
    expect(new DidsModuleConfig({ cacheScope: { cheqd: 'context' } }).getCacheScope('cheqd')).toBe('context')
  })
})
