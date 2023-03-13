/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { InitConfig, WalletConfig } from '@aries-framework/core'

import { AskarModule } from '@aries-framework/askar'
import { utils, ConsoleLogger, LogLevel, KeyDerivationMethod, Agent } from '@aries-framework/core'
import { IndySdkModule } from '@aries-framework/indy-sdk'
import { agentDependencies } from '@aries-framework/node'
import { ariesAskar, Migration } from '@hyperledger/aries-askar-nodejs'
import { registerAriesAskar } from '@hyperledger/aries-askar-shared'
import fs from 'fs'
import indy from 'indy-sdk'
import { homedir } from 'os'
import path from 'path'

import { IndySdkToAskarMigrationUpdater } from '../src'

describe('Migrate', () => {
  const config: InitConfig = {
    label: 'test-agent',
    walletConfig: {
      id: `walletwallet.0-${utils.uuid()}`,
      key: 'GfwU1DC7gEZNs3w41tjBiZYj7BNToDoFEqKY6wZXqs1A',
      keyDerivationMethod: KeyDerivationMethod.Raw,
    },
    // logger: new ConsoleLogger(LogLevel.trace),
  }

  const oldAgent = new Agent({
    config,
    modules: { indySdk: new IndySdkModule({ indySdk: indy }) },
    dependencies: agentDependencies,
  })

  const newAgent = new Agent({
    config,
    modules: { askar: new AskarModule() },
    dependencies: agentDependencies,
  })

  const oldDbPath = `${homedir()}/.indy_client/wallet/${oldAgent.config.walletConfig?.id}/sqlite.db`
  const newDbPath = `${homedir()}/.afj/data/wallet/${newAgent.config.walletConfig?.id}/sqlite.db`

  beforeAll(() => {
    registerAriesAskar({ askar: ariesAskar })
  })

  // TODO: update with an aca-py issued revokable credential
  // community agent MIGHT have revocrevoc
  // TODO: should take uninitialized agent
  test('indy-sdk sqlite to aries-askar sqlite', async () => {
    const genericRecord = { foo: 'bar' }

    await oldAgent.initialize()

    const record = await oldAgent.genericRecords.save({ content: genericRecord })

    const walletConfig: WalletConfig = {
      key: oldAgent.config.walletConfig!.key,
      id: oldAgent.config.walletConfig!.id,
      keyDerivationMethod: oldAgent.config.walletConfig!.keyDerivationMethod,
    }

    await oldAgent.shutdown()

    await Migration.migrate({
      walletName: walletConfig.id,
      walletKey: walletConfig.key,
      kdfLevel: walletConfig.keyDerivationMethod?.toString() ?? 'ARGON2I_MOD',
      specUri: oldDbPath,
    })

    const updater = await IndySdkToAskarMigrationUpdater.initialize({ uri: `sqlite://${oldDbPath}`, agent: oldAgent })
    await updater.update()

    fs.mkdirSync(path.dirname(newDbPath), { recursive: true })

    await newAgent.initialize()
    // await newAgent.wallet.import(oldAgent.config.walletConfig!, {
    //   path: oldDbPath,
    //   key: oldAgent.config.walletConfig!.key,
    // })

    await expect(newAgent.genericRecords.findById(record.id)).resolves.toMatchObject(genericRecord)
  })
})
