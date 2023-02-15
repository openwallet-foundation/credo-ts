import { DidsModule, utils } from '@aries-framework/core'
import indySdk from 'indy-sdk'

import { genesisPath, taaVersion, taaAcceptanceMechanism } from '../../core/tests/helpers'
import { IndySdkModule, IndySdkSovDidRegistrar, IndySdkSovDidResolver } from '../src'

export { indySdk }

export const getIndySdkModules = () => ({
  indySdk: new IndySdkModule({
    indySdk,
    networks: [
      {
        id: `localhost-${utils.uuid()}`,
        isProduction: false,
        genesisPath,
        indyNamespace: 'localhost',
        transactionAuthorAgreement: { version: taaVersion, acceptanceMechanism: taaAcceptanceMechanism },
      },
    ],
  }),
  dids: new DidsModule({
    registrars: [new IndySdkSovDidRegistrar()],
    resolvers: [new IndySdkSovDidResolver()],
  }),
})
