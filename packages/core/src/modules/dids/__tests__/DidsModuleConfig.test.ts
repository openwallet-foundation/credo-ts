import type { DidRegistrar, DidResolver } from '../domain'

import { KeyDidRegistrar, PeerDidRegistrar, KeyDidResolver, PeerDidResolver, WebDidResolver } from '..'
import { DidsModuleConfig } from '../DidsModuleConfig'

describe('DidsModuleConfig', () => {
  test('sets default values', () => {
    const config = new DidsModuleConfig()

    expect(config.registrars).toEqual([expect.any(KeyDidRegistrar), expect.any(PeerDidRegistrar)])
    expect(config.resolvers).toEqual([
      expect.any(WebDidResolver),
      expect.any(KeyDidResolver),
      expect.any(PeerDidResolver),
    ])
  })

  test('sets values', () => {
    const registrars = [new PeerDidRegistrar(), {} as DidRegistrar]
    const resolvers = [new PeerDidResolver(), {} as DidResolver]
    const config = new DidsModuleConfig({
      registrars,
      resolvers,
    })

    expect(config.registrars).toEqual(registrars)
    expect(config.resolvers).toEqual(resolvers)
  })

  test('adds peer did resolver and registrar if not provided in config', () => {
    const registrar = {} as DidRegistrar
    const resolver = {} as DidResolver
    const config = new DidsModuleConfig({
      registrars: [registrar],
      resolvers: [resolver],
    })

    expect(config.registrars).toEqual([registrar, expect.any(PeerDidRegistrar)])
    expect(config.resolvers).toEqual([resolver, expect.any(PeerDidResolver)])
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
})
