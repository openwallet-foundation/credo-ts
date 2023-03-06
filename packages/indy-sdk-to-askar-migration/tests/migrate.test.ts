import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { registerAriesAskar } from '@hyperledger/aries-askar-shared'

import { IndySdkToAskarMigrationUpdater } from '../src'

describe('Migrate', () => {
  beforeAll(() => {
    registerAriesAskar({ askar: ariesAskar })
  })

  // beforeEach(async () => {
  //   await new Promise((resolve) =>
  //     fs.copyFile(
  //       '/Users/beri/.indy_client/wallet/walletwallet.0/sqlite.db',
  //       '/Users/beri/.indy_client/wallet/walletwallet.0/sqlite.bak.db',
  //       resolve
  //     )
  //   )
  // })

  test('indy-sdk sqlite to aries-askar sqlite', async () => {
    // try {
    const walletName = 'walletwallet.0'
    const walletKey = 'GfwU1DC7gEZNs3w41tjBiZYj7BNToDoFEqKY6wZXqs1A'
    const dbPath = `/Users/beri/Developer/work/hyperledger/aries-askar/tests/indy_wallet_sqlite_upgraded.db`
    const specUri = `sqlite://${dbPath}`
    const updater = await IndySdkToAskarMigrationUpdater.init(specUri, walletName, walletKey)
    await updater.update()
    // } finally {
    //   await new Promise((resolve) =>
    //     fs.rename(
    //       '/Users/beri/.indy_client/wallet/walletwallet.0/sqlite.bak.db',
    //       '/Users/beri/.indy_client/wallet/walletwallet.0/sqlite.db',
    //       resolve
    //     )
    //   )
    // }
  })
})
