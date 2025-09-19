import type { WalletConfig } from '@credo-ts/core'

import { SigningProviderRegistry, WalletDuplicateError, WalletNotFoundError, KeyDerivationMethod } from '@credo-ts/core'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { askar } from '@openwallet-foundation/askar-nodejs'

import { testLogger, agentDependencies } from '../../../../core/tests'
import { AskarModuleConfig } from '../../AskarModuleConfig'
import { AskarProfileWallet } from '../AskarProfileWallet'
import { AskarWallet } from '../AskarWallet'

const hyperledgerAskarConfig = new AskarModuleConfig({
  ariesAskar: ariesAskar,
})

const owfAskarConfig = new AskarModuleConfig({
  ariesAskar: askar,
})

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

  test('Create, open, close, delete with hyperledger aries askar', async () => {
    const signingProviderRegistry = new SigningProviderRegistry([])
    rootAskarWallet = new AskarWallet(
      testLogger,
      new agentDependencies.FileSystem(),
      signingProviderRegistry,
      hyperledgerAskarConfig
    )

    // Create and open wallet
    await rootAskarWallet.createAndOpen(rootWalletConfig)

    profileAskarWallet = new AskarProfileWallet(
      rootAskarWallet.store,
      testLogger,
      signingProviderRegistry,
      hyperledgerAskarConfig
    )

    // Create, open and close profile
    await profileAskarWallet.create({ ...rootWalletConfig, id: 'profile-id' })
    await profileAskarWallet.open({ ...rootWalletConfig, id: 'profile-id' })
    await profileAskarWallet.close()

    // try to re-create it
    await expect(profileAskarWallet.createAndOpen({ ...rootWalletConfig, id: 'profile-id' })).rejects.toThrow(
      WalletDuplicateError
    )

    // Re-open profile
    await profileAskarWallet.open({ ...rootWalletConfig, id: 'profile-id' })

    // try to open non-existent wallet
    await expect(profileAskarWallet.open({ ...rootWalletConfig, id: 'non-existent-profile-id' })).rejects.toThrow(
      WalletNotFoundError
    )
  })

  test('Create, open, close, delete with owf aries askar', async () => {
    const signingProviderRegistry = new SigningProviderRegistry([])
    rootAskarWallet = new AskarWallet(
      testLogger,
      new agentDependencies.FileSystem(),
      signingProviderRegistry,
      owfAskarConfig
    )

    // Create and open wallet
    await rootAskarWallet.createAndOpen(rootWalletConfig)

    profileAskarWallet = new AskarProfileWallet(
      rootAskarWallet.store,
      testLogger,
      signingProviderRegistry,
      owfAskarConfig
    )

    // Create, open and close profile
    await profileAskarWallet.create({ ...rootWalletConfig, id: 'profile-id' })
    await profileAskarWallet.open({ ...rootWalletConfig, id: 'profile-id' })
    await profileAskarWallet.close()

    // try to re-create it
    await expect(profileAskarWallet.createAndOpen({ ...rootWalletConfig, id: 'profile-id' })).rejects.toThrow(
      WalletDuplicateError
    )

    // Re-open profile
    await profileAskarWallet.open({ ...rootWalletConfig, id: 'profile-id' })

    // try to open non-existent wallet
    await expect(profileAskarWallet.open({ ...rootWalletConfig, id: 'non-existent-profile-id' })).rejects.toThrow(
      WalletNotFoundError
    )
  })
})
