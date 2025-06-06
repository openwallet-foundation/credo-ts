import { HederaModuleConfigOptions } from '@credo-ts/hedera'
import { HederaModule } from '../src'

export const getHederaModuleConfig = () =>
  ({
    networks: [
      {
        network: 'testnet',
        operatorId: '',
        operatorKey: '',
      },
    ],
  }) satisfies HederaModuleConfigOptions

export const getHederaModules = () => ({
  hederaSdk: new HederaModule(getHederaModuleConfig()),
  // dids: new DidsModule({
  //   registrars: [new HederaDidRegistrar()],
  //   resolvers: [new HederaDidResolver()],
  // }),
})
