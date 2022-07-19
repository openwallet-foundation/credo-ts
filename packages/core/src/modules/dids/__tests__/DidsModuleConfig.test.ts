import type { Constructor } from '../../../utils/mixins'
import type { DidRegistrar, DidResolver } from '../domain'

import {
  KeyDidRegistrar,
  SovDidRegistrar,
  PeerDidRegistrar,
  KeyDidResolver,
  PeerDidResolver,
  SovDidResolver,
  WebDidResolver,
} from '..'
import { DidsModuleConfig } from '../DidsModuleConfig'

describe('DidsModuleConfig', () => {
  test('sets default values', () => {
    const config = new DidsModuleConfig()

    expect(config.registrars).toEqual([KeyDidRegistrar, SovDidRegistrar, PeerDidRegistrar])
    expect(config.resolvers).toEqual([SovDidResolver, WebDidResolver, KeyDidResolver, PeerDidResolver])
  })

  test('sets values', () => {
    const registrars = [PeerDidRegistrar, {} as Constructor<DidRegistrar>]
    const resolvers = [PeerDidResolver, {} as Constructor<DidResolver>]
    const config = new DidsModuleConfig({
      registrars,
      resolvers,
    })

    expect(config.registrars).toEqual(registrars)
    expect(config.resolvers).toEqual(resolvers)
  })

  test('adds peer did resolver and registrar if not provided in config', () => {
    const registrar = {} as Constructor<DidRegistrar>
    const resolver = {} as Constructor<DidResolver>
    const config = new DidsModuleConfig({
      registrars: [registrar],
      resolvers: [resolver],
    })

    expect(config.registrars).toEqual([registrar, PeerDidRegistrar])
    expect(config.resolvers).toEqual([resolver, PeerDidResolver])
  })
})
