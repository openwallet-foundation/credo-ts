import type { CheqdModuleConfigOptions } from '../src'

import { DidsModule, KeyDidRegistrar, KeyDidResolver } from '@aries-framework/core'
import { IndySdkModule, IndySdkModuleConfig } from '@aries-framework/indy-sdk'
import indySdk from 'indy-sdk'

import { CheqdModule, CheqdDidRegistrar, CheqdDidResolver } from '../src'

export const getIndySdkModuleConfig = () =>
  new IndySdkModuleConfig({
    indySdk,
  })

export const getCheqdModuleConfig = (seed?: string) =>
  ({
    networks: [
      {
        network: 'testnet',
        cosmosPayerSeed:
          seed ||
          'sketch mountain erode window enact net enrich smoke claim kangaroo another visual write meat latin bacon pulp similar forum guilt father state erase bright',
      },
    ],
  } satisfies CheqdModuleConfigOptions)

export const getCheqdModules = (seed?: string) => ({
  cheqdSdk: new CheqdModule(getCheqdModuleConfig(seed)),
  dids: new DidsModule({
    registrars: [new CheqdDidRegistrar(), new KeyDidRegistrar()],
    resolvers: [new CheqdDidResolver(), new KeyDidResolver()],
  }),
  indySdk: new IndySdkModule(getIndySdkModuleConfig()),
})
