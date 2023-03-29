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
  beforeAll(() => {
    registerAriesAskar({ askar: ariesAskar })
  })

  test('indy-sdk sqlite to aries-askar sqlite successful migration', async () => {
    const indySdkAndAskarConfig: InitConfig = {
      label: `indy | indy-sdk sqlite to aries-askar sqlite successful migration | ${utils.uuid()}`,
      walletConfig: {
        id: `indy-sdk sqlite to aries-askar sqlite successful migration | ${utils.uuid()}`,
        key: 'GfwU1DC7gEZNs3w41tjBiZYj7BNToDoFEqKY6wZXqs1A',
        keyDerivationMethod: KeyDerivationMethod.Raw,
      },
    }

    const indySdkAgent = new Agent({
      config: indySdkAndAskarConfig,
      modules: { indySdk: new IndySdkModule({ indySdk: indy }) },
      dependencies: agentDependencies,
    })

    const indySdkAgentDbPath = `${homedir()}/.indy_client/wallet/${indySdkAndAskarConfig.walletConfig?.id}/sqlite.db`

    const genericRecordContent = { foo: 'bar' }

    await indySdkAgent.initialize()

    const record = await indySdkAgent.genericRecords.save({ content: genericRecordContent })

    await indySdkAgent.shutdown()

    const askarAgent = new Agent({
      config: indySdkAndAskarConfig,
      modules: { askar: new AskarModule({ ariesAskar }) },
      dependencies: agentDependencies,
    })

    const updater = await IndySdkToAskarMigrationUpdater.initialize({ dbPath: indySdkAgentDbPath, agent: askarAgent })
    await updater.update()

    await askarAgent.initialize()

    await expect(askarAgent.genericRecords.findById(record.id)).resolves.toMatchObject({
      content: genericRecordContent,
    })

    await askarAgent.shutdown()
  })

  /*
   * - Initialize an agent
   * - Save a generic record
   * - try to migrate with invalid state (wrong key)
   *     - Migration will be attempted, fails, and restores
   *  - Check if the record can still be accessed
   */
  test('indy-sdk sqlite to aries-askar sqlite fails and restores', async () => {
    const indySdkAndAskarConfig: InitConfig = {
      label: `indy | indy-sdk sqlite to aries-askar sqlite fails and restores | ${utils.uuid()}`,
      walletConfig: {
        id: `indy-sdk sqlite to aries-askar sqlite fails and restores | ${utils.uuid()}`,
        key: 'GfwU1DC7gEZNs3w41tjBiZYj7BNToDoFEqKY6wZXqs1A',
        keyDerivationMethod: KeyDerivationMethod.Raw,
      },
    }

    const indySdkAgent = new Agent({
      config: indySdkAndAskarConfig,
      modules: { indySdk: new IndySdkModule({ indySdk: indy }) },
      dependencies: agentDependencies,
    })

    const indySdkAgentDbPath = `${homedir()}/.indy_client/wallet/${indySdkAndAskarConfig.walletConfig?.id}/sqlite.db`

    const genericRecordContent = { foo: 'bar' }

    await indySdkAgent.initialize()

    const record = await indySdkAgent.genericRecords.save({ content: genericRecordContent })

    await indySdkAgent.shutdown()

    const askarAgent = new Agent({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      config: { ...indySdkAndAskarConfig, walletConfig: { ...indySdkAndAskarConfig.walletConfig!, key: 'wrong-key' } },
      modules: {
        askar: new AskarModule({
          ariesAskar,
        }),
      },
      dependencies: agentDependencies,
    })

    const updater = await IndySdkToAskarMigrationUpdater.initialize({
      dbPath: indySdkAgentDbPath,
      agent: askarAgent,
    })

    await expect(updater.update()).rejects.toThrowError(IndySdkToAskarMigrationError)

    await indySdkAgent.initialize()

    await expect(indySdkAgent.genericRecords.findById(record.id)).resolves.toMatchObject({
      content: genericRecordContent,
    })
  })
})
