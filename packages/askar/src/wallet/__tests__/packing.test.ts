import type { WalletConfig, WalletPackOptions } from '@aries-framework/core'

import {
  BasicMessage,
  DidCommMessageVersion,
  JsonTransformer,
  KeyDerivationMethod,
  KeyProviderRegistry,
  KeyType,
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

const message = new BasicMessage({ content: 'hello' })

describeRunInNodeVersion([18], 'askarWallet packing', () => {
  let askarWallet: AskarWallet

  beforeEach(async () => {
    askarWallet = new AskarWallet(testLogger, new agentDependencies.FileSystem(), new KeyProviderRegistry([]))
    await askarWallet.createAndOpen(walletConfig)
  })

  afterEach(async () => {
    await askarWallet.delete()
  })

  describe('DIDComm V1 packing and unpacking', () => {
    test('Authcrypt', async () => {
      // Create both sender and recipient keys
      const senderKey = await askarWallet.createKey({ keyType: KeyType.Ed25519 })
      const recipientKey = await askarWallet.createKey({ keyType: KeyType.Ed25519 })

      const params: WalletPackOptions = {
        didCommVersion: DidCommMessageVersion.V1,
        recipientKeys: [recipientKey],
        senderKey: senderKey,
      }

      const encryptedMessage = await askarWallet.pack(message.toJSON(), params)
      const plainTextMessage = await askarWallet.unpack(encryptedMessage)
      expect(JsonTransformer.fromJSON(plainTextMessage.plaintextMessage, BasicMessage)).toEqual(message)
    })

    test('Anoncrypt', async () => {
      // Create recipient keys only
      const recipientKey = await askarWallet.createKey({ keyType: KeyType.Ed25519 })

      const params: WalletPackOptions = {
        didCommVersion: DidCommMessageVersion.V1,
        recipientKeys: [recipientKey],
        senderKey: null,
      }

      const encryptedMessage = await askarWallet.pack(message.toJSON(), params)
      const plainTextMessage = await askarWallet.unpack(encryptedMessage)
      expect(JsonTransformer.fromJSON(plainTextMessage.plaintextMessage, BasicMessage)).toEqual(message)
    })
  })

  describe('DIDComm V2 packing and unpacking', () => {
    test('Authcrypt', async () => {
      // Create both sender and recipient keys
      const senderKey = await askarWallet.createKey({ keyType: KeyType.X25519 })
      const recipientKey = await askarWallet.createKey({ keyType: KeyType.X25519 })

      const params: WalletPackOptions = {
        didCommVersion: DidCommMessageVersion.V2,
        recipientKeys: [recipientKey],
        senderKey: senderKey,
      }

      const encryptedMessage = await askarWallet.pack(message.toJSON(), params)
      const plainTextMessage = await askarWallet.unpack(encryptedMessage)
      expect(JsonTransformer.fromJSON(plainTextMessage.plaintextMessage, BasicMessage)).toEqual(message)
    })

    test('Anoncrypt', async () => {
      // Create recipient keys only
      const recipientKey = await askarWallet.createKey({ keyType: KeyType.X25519 })

      const params: WalletPackOptions = {
        didCommVersion: DidCommMessageVersion.V2,
        recipientKeys: [recipientKey],
        senderKey: null,
      }

      const encryptedMessage = await askarWallet.pack(message.toJSON(), params)
      const plainTextMessage = await askarWallet.unpack(encryptedMessage)
      expect(JsonTransformer.fromJSON(plainTextMessage.plaintextMessage, BasicMessage)).toEqual(message)
    })
  })
})
