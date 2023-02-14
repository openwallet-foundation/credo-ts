import { DidsModule, utils } from '@aries-framework/core'
import indySdk from 'indy-sdk'

import { genesisPath, taaVersion, taaAcceptanceMechanism } from '../../core/tests/helpers'
import { IndySdkModule, IndySdkSovDidRegistrar, IndySdkSovDidResolver } from '../src'

export const getIndySdkModules = ({
  indyNamespace = `localhost-${utils.uuid()}`,
}: { indyNamespace?: string } = {}) => ({
  indySdk: new IndySdkModule({
    indySdk,
    networks: [
      {
        isProduction: false,
        genesisPath,
        indyNamespace,
        transactionAuthorAgreement: { version: taaVersion, acceptanceMechanism: taaAcceptanceMechanism },
      },
    ],
  }),
  dids: new DidsModule({
    registrars: [new IndySdkSovDidRegistrar()],
    resolvers: [new IndySdkSovDidResolver()],
  }),
})
