import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { registerAriesAskar } from '@hyperledger/aries-askar-shared'

import { IndySdkToAskarMigrationUpdater } from '../src'

describe('Migrate', () => {
  beforeAll(() => {
    registerAriesAskar({ askar: ariesAskar })
  })

  test('indy-sdk sqlite to aries-askar sqlite', async () => {
    const walletName = 'walletwallet.0'
    const walletKey = 'GfwU1DC7gEZNs3w41tjBiZYj7BNToDoFEqKY6wZXqs1A'
    const specUri = `sqlite:///Users/beri/.indy_client/wallet/${walletName}/sqlite.db`
    const updater = await IndySdkToAskarMigrationUpdater.init(specUri, walletName, walletKey)
    await updater.update()
  })
})
