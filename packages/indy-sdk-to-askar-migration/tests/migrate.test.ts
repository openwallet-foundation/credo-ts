import { AskarModule } from '@credo-ts/askar'
import type { InitConfig } from '@credo-ts/core'
import { Agent } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { homedir } from 'os'
import path from 'path'
import { askar } from '../../askar/tests/helpers'
import { IndySdkToAskarMigrationUpdater } from '../src'
import { IndySdkToAskarMigrationError } from '../src/errors/IndySdkToAskarMigrationError'

describe('Indy SDK To Askar Migration', () => {
  test('indy-sdk sqlite to aries-askar sqlite successful migration', async () => {
    const indySdkAndAskarConfig: InitConfig = {
      autoUpdateStorageOnStartup: true,
    }

    const indySdkAgentDbPath = `${homedir()}/.indy_client/wallet/indy-sdk sqlite to aries-askar sqlite successful migration/sqlite.db`
    const indySdkWalletTestPath = path.join(__dirname, 'indy-sdk-040-wallet.db')
    const askarAgent = new Agent({
      config: indySdkAndAskarConfig,
      modules: {
        askar: new AskarModule({
          askar,
          store: {
            id: 'indy-sdk sqlite to aries-askar sqlite successful migration',
            key: 'GfwU1DC7gEZNs3w41tjBiZYj7BNToDoFEqKY6wZXqs1A',
            keyDerivationMethod: 'raw',
          },
        }),
      },
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

    await updater.update()
    await askarAgent.initialize()

    await expect(askarAgent.genericRecords.getAll()).resolves.toMatchObject([
      {
        content: {
          foo: 'bar',
        },
      },
    ])

    // Ensure the migrated wallet keys still work with the new kms
    await expect(
      askarAgent.kms.getPublicKey({
        keyId: '8b8S451U9Hf4iZFdYJRuvPBBVbwW3jH8J1BH2CGEEDZD',
      })
    ).resolves.toEqual({
      crv: 'Ed25519',
      d: undefined,
      kid: '8b8S451U9Hf4iZFdYJRuvPBBVbwW3jH8J1BH2CGEEDZD',
      kty: 'OKP',
      x: 'cL_1liG48WAFSltbtvsi4Os2of3DNrqCkg4WOu2xAnQ',
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
    const indySdkAndAskarConfig: InitConfig = {}

    const indySdkAgentDbPath = `${homedir()}/.indy_client/wallet/indy-sdk sqlite to aries-askar sqlite fails and restores/sqlite.db`
    const indySdkWalletTestPath = path.join(__dirname, 'indy-sdk-040-wallet.db')

    const askarAgent = new Agent({
      config: indySdkAndAskarConfig,
      modules: {
        askar: new AskarModule({
          askar,
          store: {
            id: 'indy-sdk sqlite to aries-askar sqlite fails and restores',
            // NOTE: wrong key passed
            key: 'wrong-key',
            keyDerivationMethod: 'raw',
          },
        }),
      },
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
