import { DidsModule, KeyDidRegistrar, KeyDidResolver, utils } from '@aries-framework/core'
import indySdk from 'indy-sdk'

import { genesisPath, taaVersion, taaAcceptanceMechanism } from '../../core/tests/helpers'
import { IndySdkModule, IndySdkModuleConfig, IndySdkSovDidRegistrar, IndySdkSovDidResolver } from '../src'

export { indySdk }

export const getIndySdkModuleConfig = () =>
  new IndySdkModuleConfig({
    indySdk,
    networks: [
      {
        id: `localhost-${utils.uuid()}`,
        isProduction: false,
        genesisPath,
        indyNamespace: 'pool:localtest',
        transactionAuthorAgreement: { version: taaVersion, acceptanceMechanism: taaAcceptanceMechanism },
      },
    ],
  })

export const getIndySdkModules = () => ({
  indySdk: new IndySdkModule(getIndySdkModuleConfig()),
  dids: new DidsModule({
    registrars: [new IndySdkSovDidRegistrar(), new KeyDidRegistrar()],
    resolvers: [new IndySdkSovDidResolver(), new KeyDidResolver()],
  }),
})
