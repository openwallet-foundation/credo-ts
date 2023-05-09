import type { WalletConfig } from '@aries-framework/core'

import {
  JsonTransformer,
  BasicMessage,
  KeyType,
  SigningProviderRegistry,
  KeyDerivationMethod,
} from '@aries-framework/core'

import { describeRunInNodeVersion } from '../../../../../tests/runInVersion'
import { agentDependencies } from '../../../../core/tests/helpers'
import testLogger from '../../../../core/tests/logger'
import { AskarWallet } from '../AskarWallet'

// use raw key derivation method to speed up wallet creating / opening / closing between tests
const walletConfig: WalletConfig = {
  id: 'Askar Wallet Packing',
  // generated using indy.generateWalletKey
  key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
  keyDerivationMethod: KeyDerivationMethod.Raw,
}

describeRunInNodeVersion([18], 'askarWallet packing', () => {
  let askarWallet: AskarWallet

  beforeEach(async () => {
    askarWallet = new AskarWallet(testLogger, new agentDependencies.FileSystem(), new SigningProviderRegistry([]))
    await askarWallet.createAndOpen(walletConfig)
  })

  afterEach(async () => {
    await askarWallet.delete()
  })

  test('DIDComm V1 packing and unpacking', async () => {
    // Create both sender and recipient keys
    const senderKey = await askarWallet.createKey({ keyType: KeyType.Ed25519 })
    const recipientKey = await askarWallet.createKey({ keyType: KeyType.Ed25519 })

    const message = new BasicMessage({ content: 'hello' })

    const encryptedMessage = await askarWallet.pack(
      message.toJSON(),
      [recipientKey.publicKeyBase58],
      senderKey.publicKeyBase58
    )

    const plainTextMessage = await askarWallet.unpack(encryptedMessage)

    expect(JsonTransformer.fromJSON(plainTextMessage.plaintextMessage, BasicMessage)).toEqual(message)
  })
})
