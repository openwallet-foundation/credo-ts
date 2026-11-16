import { DidsModuleConfig } from '../DidsModuleConfig'
import type { DidRegistrar, DidResolver } from '../domain'
import {
  JwkDidRegistrar,
  JwkDidResolver,
  KeyDidRegistrar,
  KeyDidResolver,
  PeerDidRegistrar,
  PeerDidResolver,
  WebDidResolver,
} from '../methods'

describe('DidsModuleConfig', () => {
  test('sets default values', () => {
    const config = new DidsModuleConfig()

    expect(config.registrars).toEqual([
      expect.any(KeyDidRegistrar),
      expect.any(PeerDidRegistrar),
      expect.any(JwkDidRegistrar),
    ])
    expect(config.resolvers).toEqual([
      expect.any(WebDidResolver),
      expect.any(KeyDidResolver),
      expect.any(PeerDidResolver),
      expect.any(JwkDidResolver),
    ])
    expect(config.cacheScope).toEqual({})
    for (const method of ['web', 'key', 'jwk', 'peer', 'external']) {
      expect(config.getCacheScope(method)).toBe('global')
    }
    for (const resolver of config.resolvers) {
      expect(resolver.allowsCaching).toBe(resolver instanceof WebDidResolver)
    }
  })

  test('sets values', () => {
    const registrars = [new PeerDidRegistrar(), new KeyDidRegistrar(), {} as DidRegistrar]
    const resolvers = [new PeerDidResolver(), new KeyDidResolver(), {} as DidResolver]
    const cacheScope = { web: 'context', external: 'global' } as const
    const config = new DidsModuleConfig({
      registrars,
      resolvers,
      cacheScope,
    })

    expect(config.registrars).toEqual(registrars)
    expect(config.resolvers).toEqual(resolvers)
    expect(config.cacheScope).toBe(cacheScope)
  })

  test('adds peer and key did resolvers and registrars if not provided in config', () => {
    const registrar = {} as DidRegistrar
    const resolver = {} as DidResolver
    const config = new DidsModuleConfig({
      registrars: [registrar],
      resolvers: [resolver],
    })

    expect(config.registrars).toEqual([registrar, expect.any(PeerDidRegistrar), expect.any(KeyDidRegistrar)])
    expect(config.resolvers).toEqual([resolver, expect.any(PeerDidResolver), expect.any(KeyDidResolver)])
  })

  test('add resolver and registrar after creation', () => {
    const registrar = {} as DidRegistrar
    const resolver = {} as DidResolver
    const config = new DidsModuleConfig({
      resolvers: [],
      registrars: [],
    })

    expect(config.registrars).not.toContain(registrar)
    expect(config.resolvers).not.toContain(resolver)

    config.addRegistrar(registrar)
    config.addResolver(resolver)

    expect(config.registrars).toContain(registrar)
    expect(config.resolvers).toContain(resolver)
  })

  test('applies sparse overrides to dynamically registered methods without leaking between instances', () => {
    const config = new DidsModuleConfig({ cacheScope: { external: 'context' } })
    const otherConfig = new DidsModuleConfig()
    const resolver: DidResolver = {
      supportedMethods: ['external', 'another', 'external'],
      allowsCaching: true,
      resolve: vi.fn(),
    }

    config.addResolver(resolver)

    expect(config.getCacheScope('external')).toBe('context')
    expect(config.getCacheScope('another')).toBe('global')
    expect(otherConfig.cacheScope).toEqual({})
    expect(otherConfig.getCacheScope('external')).toBe('global')
  })

  test.each([undefined, 'context', 'global'] as const)('uses method override %s with global fallback', (scope) => {
    const config = new DidsModuleConfig({ cacheScope: { external: scope } })

    expect(config.getCacheScope('external')).toBe(scope ?? 'global')
    expect(config.getCacheScope('web')).toBe('global')
  })

  test.each([undefined, {}])('defaults to global with cacheScope %j', (cacheScope) => {
    const config = new DidsModuleConfig({ cacheScope })

    expect(config.getCacheScope('external')).toBe('global')
  })

  test('does not interpret inherited object properties as scope overrides', () => {
    const config = new DidsModuleConfig({ cacheScope: { web: 'context' } })

    for (const method of ['constructor', 'tostring', '__proto__']) {
      expect(config.getCacheScope(method)).toBe('global')
    }
  })
})
