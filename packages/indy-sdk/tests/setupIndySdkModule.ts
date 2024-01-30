import { DidsModule, utils } from '@credo-ts/core'
import indySdk from 'indy-sdk'

import { genesisPath, taaVersion, taaAcceptanceMechanism } from '../../core/tests/helpers'
import {
  IndySdkModule,
  IndySdkModuleConfig,
  IndySdkIndyDidRegistrar,
  IndySdkSovDidResolver,
  IndySdkIndyDidResolver,
} from '../src'

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
    registrars: [new IndySdkIndyDidRegistrar()],
    resolvers: [new IndySdkSovDidResolver(), new IndySdkIndyDidResolver()],
  }),
})
