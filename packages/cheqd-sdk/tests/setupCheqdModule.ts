import { DidsModule, KeyDidRegistrar, KeyDidResolver } from '@aries-framework/core'
import { IndySdkModule, IndySdkModuleConfig } from '@aries-framework/indy-sdk'
import indySdk from 'indy-sdk'

import { CheqdModule, CheqdModuleConfig, CheqdDidRegistrar, CheqdDidResolver } from '../src'

export const getIndySdkModuleConfig = () =>
  new IndySdkModuleConfig({
    indySdk,
  })

export const getCheqdModuleConfig = () =>
  new CheqdModuleConfig({
    networks: [
      {
        network: 'testnet',
        cosmosPayerSeed:
          'sketch mountain erode window enact net enrich smoke claim kangaroo another visual write meat latin bacon pulp similar forum guilt father state erase bright',
      },
    ],
  })

export const getCheqdModules = () => ({
  cheqdSdk: new CheqdModule(getCheqdModuleConfig()),
  dids: new DidsModule({
    registrars: [new CheqdDidRegistrar(), new KeyDidRegistrar()],
    resolvers: [new CheqdDidResolver(), new KeyDidResolver()],
  }),
  indySdk: new IndySdkModule(getIndySdkModuleConfig()),
})
