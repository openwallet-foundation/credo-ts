import type { HederaModuleConfigOptions } from '../../../src'
import type { Cache, Logger, ModulesMap } from '@credo-ts/core'
import type { HederaNetwork } from '@hiero-did-sdk/client'

import { AnonCredsModule } from '@credo-ts/anoncreds'
import { Agent, CacheModule, DidsModule, utils } from '@credo-ts/core'
import { anoncreds } from '@hyperledger/anoncreds-nodejs'

import { InMemoryTailsFileService } from '../../../../anoncreds/tests/InMemoryTailsFileService'
import { getInMemoryAgentOptions } from '../../../../core/tests/helpers'
import { HederaAnonCredsRegistry, HederaDidRegistrar, HederaDidResolver, HederaModule } from '../../../src'

export const getHederaModuleConfig = (props: {
  network?: HederaNetwork
  operatorId?: string
  operatorKey?: string
}): HederaModuleConfigOptions => {
  return {
    networks: [
      {
        network: props.network ?? (process.env.HEDERA_NETWORK as HederaNetwork) ?? 'testnet',
        operatorId: props.operatorId ?? process.env.HEDERA_OPERATOR_ID ?? '0.0.5489553',
        operatorKey:
          props.operatorKey ??
          process.env.HEDERA_OPERATOR_KEY ??
          '302e020100300506032b6570042204209f54b75b6238ced43e41b1463999cb40bf2f7dd2c9fd4fd3ef780027c016a138',
      },
    ],
  }
}

export const getHederaAgent = (props: {
  operatorId?: string
  operatorKey?: string
  label?: string
  logger?: Logger
  cache?: Cache
}) => {
  const label = props.label ?? utils.uuid()
  const logger = props.logger
  const cache = props.cache

  let modules: ModulesMap = {
    anoncreds: new AnonCredsModule({
      anoncreds,
      registries: [new HederaAnonCredsRegistry()],
      tailsFileService: new InMemoryTailsFileService(),
    }),
    dids: new DidsModule({
      resolvers: [new HederaDidResolver()],
      registrars: [new HederaDidRegistrar()],
    }),
    hedera: new HederaModule(getHederaModuleConfig(props)),
  }
  if (cache) {
    modules = { ...modules, cache: new CacheModule({ cache }) }
  }

  return new Agent(getInMemoryAgentOptions('Hedera test agent', { label, logger }, modules))
}
