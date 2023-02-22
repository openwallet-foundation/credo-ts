import { AnonCredsModule } from '@aries-framework/anoncreds'
import { DidsModule, KeyDidRegistrar, KeyDidResolver } from '@aries-framework/core'
import { IndySdkModule, IndySdkModuleConfig } from '@aries-framework/indy-sdk'
import indySdk from 'indy-sdk'

import { CheqdSdkModule, CheqdSdkModuleConfig, CheqdDidRegistrar, CheqdDidResolver } from '../src'

export const getIndySdkModuleConfig = () =>
  new IndySdkModuleConfig({
    indySdk,
  })

export const getCheqdSdkModuleConfig = () =>
  new CheqdSdkModuleConfig({
    cosmosPayerSeed:
      'sketch mountain erode window enact net enrich smoke claim kangaroo another visual write meat latin bacon pulp similar forum guilt father state erase bright',
  })

export const getCheqdSdkModules = () => ({
  cheqdSdk: new CheqdSdkModule(getCheqdSdkModuleConfig()),
  dids: new DidsModule({
    registrars: [new CheqdDidRegistrar(), new KeyDidRegistrar()],
    resolvers: [new CheqdDidResolver(), new KeyDidResolver()],
  }),
  indySdk: new IndySdkModule(getIndySdkModuleConfig()),
})
