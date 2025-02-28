import type { InitConfig } from '@credo-ts/core'

import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { homedir } from 'os'
import path from 'path'
import { Agent, KeyDerivationMethod } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'

import { askarModule } from '../../askar/tests/helpers'
import { IndySdkToAskarMigrationUpdater } from '../src'
import { IndySdkToAskarMigrationError } from '../src/errors/IndySdkToAskarMigrationError'

describe('Indy SDK To Askar Migration', () => {
  test('indy-sdk sqlite to aries-askar sqlite successful migration', async () => {
    const indySdkAndAskarConfig: InitConfig = {
      label: 'indy | indy-sdk sqlite to aries-askar sqlite successful migration',
      walletConfig: {
        id: 'indy-sdk sqlite to aries-askar sqlite successful migration',
        key: 'GfwU1DC7gEZNs3w41tjBiZYj7BNToDoFEqKY6wZXqs1A',
        keyDerivationMethod: KeyDerivationMethod.Raw,
      },
      autoUpdateStorageOnStartup: true,
    }

    const indySdkAgentDbPath = `${homedir()}/.indy_client/wallet/${indySdkAndAskarConfig.walletConfig?.id}/sqlite.db`
    const indySdkWalletTestPath = path.join(__dirname, 'indy-sdk-040-wallet.db')
    const askarAgent = new Agent({
      config: indySdkAndAskarConfig,
      modules: { askar: askarModule },
      dependencies: agentDependencies,
    })
    const updater = await IndySdkToAskarMigrationUpdater.initialize({ dbPath: indySdkAgentDbPath, agent: askarAgent })

    // Remove new wallet path (if exists)
    if (existsSync(updater.newWalletPath)) unlinkSync(updater.newWalletPath)

    // Create old wallet path and copy test wallet
    mkdirSync(path.dirname(indySdkAgentDbPath), { recursive: true })
    copyFileSync(indySdkWalletTestPath, indySdkAgentDbPath)

    await updater.update()
    await askarAgent.initialize()

    await expect(askarAgent.genericRecords.getAll()).resolves.toMatchObject([
      {
        content: {
          foo: 'bar',
        },
      },
    ])

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
      label: 'indy | indy-sdk sqlite to aries-askar sqlite fails and restores',
      walletConfig: {
        id: 'indy-sdk sqlite to aries-askar sqlite fails and restores',
        // NOTE: wrong key passed
        key: 'wrong-key',
        keyDerivationMethod: KeyDerivationMethod.Raw,
      },
    }

    const indySdkAgentDbPath = `${homedir()}/.indy_client/wallet/${indySdkAndAskarConfig.walletConfig?.id}/sqlite.db`
    const indySdkWalletTestPath = path.join(__dirname, 'indy-sdk-040-wallet.db')

    const askarAgent = new Agent({
      config: indySdkAndAskarConfig,
      modules: { askar: askarModule },
      dependencies: agentDependencies,
    })

    const updater = await IndySdkToAskarMigrationUpdater.initialize({
      dbPath: indySdkAgentDbPath,
      agent: askarAgent,
    })

    // Remove new wallet path (if exists)
    if (existsSync(updater.newWalletPath)) unlinkSync(updater.newWalletPath)

    // Create old wallet path and copy test wallet
    mkdirSync(path.dirname(indySdkAgentDbPath), { recursive: true })
    copyFileSync(indySdkWalletTestPath, indySdkAgentDbPath)

    await expect(updater.update()).rejects.toThrow(IndySdkToAskarMigrationError)
    expect(existsSync(indySdkWalletTestPath)).toBe(true)
  })
})
