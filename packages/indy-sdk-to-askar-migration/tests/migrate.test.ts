import type { InitConfig } from '@aries-framework/core'

import { AskarModule } from '@aries-framework/askar'
import { utils, KeyDerivationMethod, Agent } from '@aries-framework/core'
import { IndySdkModule } from '@aries-framework/indy-sdk'
import { agentDependencies } from '@aries-framework/node'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { registerAriesAskar } from '@hyperledger/aries-askar-shared'
import indy from 'indy-sdk'
import { homedir } from 'os'

import { describeRunInNodeVersion } from '../../../tests/runInVersion'
import { IndySdkToAskarMigrationUpdater } from '../src'
import { IndySdkToAskarMigrationError } from '../src/errors/IndySdkToAskarMigrationError'

// FIXME: Re-include in tests when NodeJS wrapper performance is improved
describeRunInNodeVersion([18], 'Indy SDK To Askar Migration', () => {
  const config: InitConfig = {
    label: 'test-agent',
    walletConfig: {
      id: `walletwallet.0-${utils.uuid()}`,
      key: 'GfwU1DC7gEZNs3w41tjBiZYj7BNToDoFEqKY6wZXqs1A',
      keyDerivationMethod: KeyDerivationMethod.Raw,
    },
  }

  const invalidConfig: InitConfig = {
    label: 'invalid-test-agent',
    walletConfig: {
      id: `walletwallet.1-${utils.uuid()}`,
      key: 'GfwU1DC7gEZNs3w41tjBiZYj7BNToDoFEqKY6wZXqs1A',
      keyDerivationMethod: KeyDerivationMethod.Raw,
    },
  }

  const invalidAgent = new Agent({
    config: invalidConfig,
    modules: {
      indySdk: new IndySdkModule({ indySdk: indy }),
    },
    dependencies: agentDependencies,
  })

  const invalidNewAgent = new Agent({
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    config: { ...invalidConfig, walletConfig: { ...invalidConfig.walletConfig!, key: 'wrong-key' } },
    modules: {
      askar: new AskarModule({
        ariesAskar,
      }),
    },
    dependencies: agentDependencies,
  })

  const oldAgent = new Agent({
    config,
    modules: {
      indySdk: new IndySdkModule({ indySdk: indy }),
    },
    dependencies: agentDependencies,
  })

  const newAgent = new Agent({
    config,
    modules: {
      askar: new AskarModule({
        ariesAskar,
      }),
    },
    dependencies: agentDependencies,
  })

  const oldAgentDbPath = `${homedir()}/.indy_client/wallet/${oldAgent.config.walletConfig?.id}/sqlite.db`
  const invalidAgentDbPath = `${homedir()}/.indy_client/wallet/${invalidAgent.config.walletConfig?.id}/sqlite.db`

  beforeAll(() => {
    registerAriesAskar({ askar: ariesAskar })
  })

  test('indy-sdk sqlite to aries-askar sqlite', async () => {
    const genericRecordContent = { foo: 'bar' }

    await oldAgent.initialize()

    const record = await oldAgent.genericRecords.save({ content: genericRecordContent })

    await oldAgent.shutdown()

    const updater = await IndySdkToAskarMigrationUpdater.initialize({ dbPath: oldAgentDbPath, agent: newAgent })
    await updater.update()

    await newAgent.initialize()

    await expect(newAgent.genericRecords.findById(record.id)).resolves.toMatchObject({ content: genericRecordContent })

    await newAgent.shutdown()
  })

  /*
   * - Initialize an agent
   * - Save a generic record
   * - try to migrate with invalid state (wrong key)
   *     - Migration will be attempted, fails, and restores
   *  - Check if the record can still be accessed
   */
  test('indy-sdk sqlite to aries-askar sqlite fails and restores', async () => {
    const genericRecordContent = { foo: 'bar' }

    await invalidAgent.initialize()

    const record = await invalidAgent.genericRecords.save({ content: genericRecordContent })

    await invalidAgent.shutdown()

    const updater = await IndySdkToAskarMigrationUpdater.initialize({
      dbPath: invalidAgentDbPath,
      agent: invalidNewAgent,
    })

    await expect(updater.update()).rejects.toThrowError(IndySdkToAskarMigrationError)

    await invalidAgent.initialize()

    await expect(invalidAgent.genericRecords.findById(record.id)).resolves.toMatchObject({
      content: genericRecordContent,
    })
  })
})
