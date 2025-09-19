import type { WalletConfig } from '@credo-ts/core'

import { JsonTransformer, BasicMessage, KeyType, SigningProviderRegistry, KeyDerivationMethod } from '@credo-ts/core'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { askar } from '@openwallet-foundation/askar-nodejs'

import { agentDependencies } from '../../../../core/tests/helpers'
import testLogger from '../../../../core/tests/logger'
import { AskarModuleConfig } from '../../AskarModuleConfig'
import { AskarWallet } from '../AskarWallet'

describe.each(['hyperledger', 'owf'] as const)('askarWallet packing', (askarImplementation) => {
  let askarWallet: AskarWallet

  const askarConfig = new AskarModuleConfig({
    ariesAskar: askarImplementation === 'hyperledger' ? ariesAskar : askar,
  })
  // use raw key derivation method to speed up wallet creating / opening / closing between tests
  const walletConfig: WalletConfig = {
    id: 'Askar Wallet Packing' + askarImplementation,
    // generated using indy.generateWalletKey
    key: 'CwNJroKHTSSj3XvE7ZAnuKiTn2C4QkFvxEqfm5rzhNrb',
    keyDerivationMethod: KeyDerivationMethod.Raw,
  }

  beforeEach(async () => {
    askarWallet = new AskarWallet(
      testLogger,
      new agentDependencies.FileSystem(),
      new SigningProviderRegistry([]),
      askarConfig
    )
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
