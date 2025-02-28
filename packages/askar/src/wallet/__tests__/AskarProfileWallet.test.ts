import type { WalletConfig } from '@credo-ts/core'

import { KeyDerivationMethod, SigningProviderRegistry, WalletDuplicateError, WalletNotFoundError } from '@credo-ts/core'

import { agentDependencies, testLogger } from '../../../../core/tests'
import { AskarProfileWallet } from '../AskarProfileWallet'
import { AskarWallet } from '../AskarWallet'

// use raw key derivation method to speed up wallet creating / opening / closing between tests
const rootWalletConfig: WalletConfig = {
  id: 'Wallet: AskarProfileWalletTest',
  // generated using indy.generateWalletKey
  key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
  keyDerivationMethod: KeyDerivationMethod.Raw,
}

describe('AskarWallet management', () => {
  let rootAskarWallet: AskarWallet
  let profileAskarWallet: AskarProfileWallet

  afterEach(async () => {
    if (profileAskarWallet) {
      await profileAskarWallet.delete()
    }

    if (rootAskarWallet) {
      await rootAskarWallet.delete()
    }
  })

  test('Create, open, close, delete', async () => {
    const signingProviderRegistry = new SigningProviderRegistry([])
    rootAskarWallet = new AskarWallet(testLogger, new agentDependencies.FileSystem(), signingProviderRegistry)

    // Create and open wallet
    await rootAskarWallet.createAndOpen(rootWalletConfig)

    profileAskarWallet = new AskarProfileWallet(rootAskarWallet.store, testLogger, signingProviderRegistry)

    // Create, open and close profile
    await profileAskarWallet.create({ ...rootWalletConfig, id: 'profile-id' })
    await profileAskarWallet.open({ ...rootWalletConfig, id: 'profile-id' })
    await profileAskarWallet.close()

    // try to re-create it
    await expect(profileAskarWallet.createAndOpen({ ...rootWalletConfig, id: 'profile-id' })).rejects.toThrowError(
      WalletDuplicateError
    )

    // Re-open profile
    await profileAskarWallet.open({ ...rootWalletConfig, id: 'profile-id' })

    // try to open non-existent wallet
    await expect(profileAskarWallet.open({ ...rootWalletConfig, id: 'non-existent-profile-id' })).rejects.toThrowError(
      WalletNotFoundError
    )
  })
})
