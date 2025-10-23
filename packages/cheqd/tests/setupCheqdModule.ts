import { DidsModule } from '@credo-ts/core'
import type { CheqdModuleConfigOptions } from '../src'

import { CheqdDidRegistrar, CheqdDidResolver, CheqdModule } from '../src'

export const cheqdPayerSeeds = [
  'sketch mountain erode window enact net enrich smoke claim kangaroo another visual write meat latin bacon pulp similar forum guilt father state erase bright',

  // cheqd1yeahnxhfa583wwpm9xt452xzet4xsgsqacgjkr
  'silk theme damp share lens select artefact orbit artwork weather mixture alarm remain oppose own wolf reduce melody cheap venture lady spy wise loud',

  // cheqd14y3xeqd2xmhl9sxn8cf974k6nntqrveufqpqrs
  'lobster pizza cost soft else rather rich find rose pride catch bar cube switch help joy stable dirt stumble voyage bind cabbage cram exist',

  // cheqd10qh2vl0jrax6yh2mzes03cm6vt27vd47geu375
  'state online hedgehog turtle daring lab panda bottom agent pottery mixture venue letter decade bridge win snake mandate trust village emerge awkward fire mimic',
] as const

export const getCheqdModuleConfig = (seed?: string, rpcUrl?: string) =>
  ({
    networks: [
      {
        rpcUrl: rpcUrl || 'http://localhost:26657',
        network: 'testnet',
        cosmosPayerSeed:
          seed ||
          'sketch mountain erode window enact net enrich smoke claim kangaroo another visual write meat latin bacon pulp similar forum guilt father state erase bright',
      },
    ],
  }) satisfies CheqdModuleConfigOptions

export const getCheqdModules = (seed?: string, rpcUrl?: string) => ({
  cheqdSdk: new CheqdModule(getCheqdModuleConfig(seed, rpcUrl)),
  dids: new DidsModule({
    registrars: [new CheqdDidRegistrar()],
    resolvers: [new CheqdDidResolver()],
  }),
})
