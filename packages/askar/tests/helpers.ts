import type { Agent, InitConfig } from '@credo-ts/core'
import type { DidCommModuleConfig } from '../..//didcomm'

import path from 'path'
import { LogLevel, utils } from '@credo-ts/core'
import { askar } from '@openwallet-foundation/askar-nodejs'
import { registerAskar } from '@openwallet-foundation/askar-shared'

import { waitForBasicMessage } from '../../core/tests/helpers'
import { TestLogger } from '../../core/tests/logger'
import { ConnectionsModule, HandshakeProtocol } from '../../didcomm'
import { getDefaultDidcommModules } from '../../didcomm/src/util/modules'
import { agentDependencies } from '../../node/src'
import { AskarPostgresStorageConfig } from '../src'
import { AskarModule } from '../src/AskarModule'

registerAskar({ askar })
export { askar }

export const genesisPath = process.env.GENESIS_TXN_PATH
  ? path.resolve(process.env.GENESIS_TXN_PATH)
  : path.join(__dirname, '../../../../network/genesis/local-genesis.txn')

export const publicDidSeed = process.env.TEST_AGENT_PUBLIC_DID_SEED ?? '000000000000000000000000Trustee9'

export const askarPostgresStorageConfig: AskarPostgresStorageConfig = {
  type: 'postgres',
  config: {
    host: 'localhost:5432',
  },
  credentials: {
    account: 'postgres',
    password: 'postgres',
  },
}

export function getAskarPostgresAgentOptions(
  name: string,
  didcommConfig: Partial<DidCommModuleConfig>,
  storageConfig: AskarPostgresStorageConfig,
  extraConfig: Partial<InitConfig> = {}
) {
  const random = utils.uuid().slice(0, 4)
  const config: InitConfig = {
    autoUpdateStorageOnStartup: false,
    logger: new TestLogger(LogLevel.off, name),
    ...extraConfig,
  }
  return {
    config,
    dependencies: agentDependencies,
    modules: {
      ...getDefaultDidcommModules(didcommConfig),
      askar: new AskarModule({
        askar,
        store: {
          id: `PostgresWallet${name}${random}`,
          key: `Key${name}`,
          database: storageConfig,
        },
      }),
      connections: new ConnectionsModule({
        autoAcceptConnections: true,
      }),
    },
  } as const
}

export function getAskarSqliteAgentOptions(
  name: string,
  didcommConfig: Partial<DidCommModuleConfig> = {},
  extraConfig: Partial<InitConfig> = {},
  inMemory?: boolean
) {
  const random = utils.uuid().slice(0, 4)
  const config: InitConfig = {
    autoUpdateStorageOnStartup: false,
    logger: new TestLogger(LogLevel.off, name),
    ...extraConfig,
  }
  return {
    config,
    dependencies: agentDependencies,
    modules: {
      ...getDefaultDidcommModules(didcommConfig),
      askar: new AskarModule({
        askar,
        store: {
          id: `SQLiteWallet${name} - ${random}`,
          key: `Key${name}`,
          database: { type: 'sqlite', config: { inMemory } },
        },
      }),
      connections: new ConnectionsModule({
        autoAcceptConnections: true,
      }),
    },
  } as const
}

/**
 * Basic E2E test: connect two agents, send a basic message and verify it they can be re initialized
 * @param senderAgent
 * @param receiverAgent
 */
export async function e2eTest(
  senderAgent: Agent<ReturnType<typeof getDefaultDidcommModules>>,
  receiverAgent: Agent<ReturnType<typeof getDefaultDidcommModules>>
) {
  const senderReceiverOutOfBandRecord = await senderAgent.modules.oob.createInvitation({
    handshakeProtocols: [HandshakeProtocol.Connections],
  })

  const { connectionRecord: bobConnectionAtReceiversender } = await receiverAgent.modules.oob.receiveInvitation(
    senderReceiverOutOfBandRecord.outOfBandInvitation,
    {
      label: 'receiver',
    }
  )
  if (!bobConnectionAtReceiversender) throw new Error('Connection not created')

  await receiverAgent.modules.connections.returnWhenIsConnected(bobConnectionAtReceiversender.id)

  const [senderConnectionAtReceiver] = await senderAgent.modules.connections.findAllByOutOfBandId(
    senderReceiverOutOfBandRecord.id
  )
  const senderConnection = await senderAgent.modules.connections.returnWhenIsConnected(senderConnectionAtReceiver.id)

  const message = 'hello, world'
  await senderAgent.modules.basicMessages.sendMessage(senderConnection.id, message)

  const basicMessage = await waitForBasicMessage(receiverAgent, {
    content: message,
  })

  expect(basicMessage.content).toBe(message)

  expect(senderAgent.isInitialized).toBe(true)
  await senderAgent.shutdown()
  expect(senderAgent.isInitialized).toBe(false)
  await senderAgent.initialize()
  expect(senderAgent.isInitialized).toBe(true)
}
