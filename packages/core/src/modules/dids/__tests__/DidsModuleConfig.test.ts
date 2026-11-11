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
    expect(config.publicDidMethods).toEqual(['web'])
    expect(config.getCacheScope('web')).toBe('global')
    for (const method of ['key', 'jwk', 'peer', 'external']) {
      expect(config.getCacheScope(method)).toBe('context')
    }
    for (const resolver of config.resolvers) {
      expect(resolver.allowsCaching).toBe(resolver instanceof WebDidResolver)
    }
  })

  test('sets values', () => {
    const registrars = [new PeerDidRegistrar(), new KeyDidRegistrar(), {} as DidRegistrar]
    const resolvers = [new PeerDidResolver(), new KeyDidResolver(), {} as DidResolver]
    const publicDidMethods = ['web', 'ethr']
    const config = new DidsModuleConfig({
      registrars,
      resolvers,
      publicDidMethods,
    })

    expect(config.registrars).toEqual(registrars)
    expect(config.resolvers).toEqual(resolvers)
    expect(config.publicDidMethods).toEqual(publicDidMethods)
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

  test('derives public methods from dynamically registered resolvers without leaking between instances', () => {
    const config = new DidsModuleConfig()
    const otherConfig = new DidsModuleConfig()
    const resolver: DidResolver = {
      supportedMethods: ['external', 'another', 'external'],
      allowsCaching: true,
      cacheScope: 'global',
      resolve: vi.fn(),
    }

    config.addResolver(resolver)

    expect(config.publicDidMethods).toEqual(['web', 'external', 'another'])
    expect(config.getCacheScope('external')).toBe('global')
    expect(otherConfig.publicDidMethods).toEqual(['web'])
    expect(otherConfig.getCacheScope('external')).toBe('context')
  })

  test.each([undefined, 'context', 'global'] as const)('uses the first matching resolver scope (%s)', (cacheScope) => {
    const firstResolver: DidResolver = {
      supportedMethods: ['external'],
      allowsCaching: true,
      cacheScope,
      resolve: vi.fn(),
    }
    const config = new DidsModuleConfig({
      resolvers: [firstResolver, { ...firstResolver, cacheScope: 'global' }],
    })

    expect(config.getCacheScope('external')).toBe(cacheScope ?? 'context')
    expect(config.publicDidMethods).toEqual(cacheScope === 'global' ? ['external'] : [])
  })

  test.each([{ publicDidMethods: [] }, { publicDidMethods: ['another'] }])(
    'explicit public methods $publicDidMethods override resolver scopes',
    ({ publicDidMethods }) => {
      const config = new DidsModuleConfig({ publicDidMethods })

      expect(config.getCacheScope('web')).toBe('context')
      expect(config.getCacheScope('another')).toBe(publicDidMethods.includes('another') ? 'global' : 'context')
      expect(config.publicDidMethods).toBe(publicDidMethods)
    }
  )
})
