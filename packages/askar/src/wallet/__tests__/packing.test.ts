import type { WalletConfig, WalletPackOptions } from '@aries-framework/core'

import {
  BasicMessage,
  DidCommMessageVersion,
  JsonTransformer,
  KeyDerivationMethod,
  KeyProviderRegistry,
  KeyType,
  Buffer,
  Key,
  AriesFrameworkError,
} from '@aries-framework/core'
import { Jwk, Key as AskarKey } from '@hyperledger/aries-askar-shared'

import { describeRunInNodeVersion } from '../../../../../tests/runInVersion'
import { TrustPingMessage } from '../../../../core/src/modules/connections/protocols/trust-ping/v2'
import { agentDependencies } from '../../../../core/tests/helpers'
import testLogger from '../../../../core/tests/logger'
import { AskarWallet } from '../AskarWallet'

import {
  aliceX25519Secret1,
  bobX25519Secret1,
  bobX25519Secret2,
  bobX25519Secret3,
  jweEcdh1PuA256CbcHs512_1,
  jweEcdhEsX25519Xc20P_1,
  message,
} from './testVectors'

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
    askarWallet = new AskarWallet(testLogger, new agentDependencies.FileSystem(), new KeyProviderRegistry([]))
    await askarWallet.createAndOpen(walletConfig)
  })

  afterEach(async () => {
    await askarWallet.delete()
  })

  describe('DIDComm V1 packing and unpacking', () => {
    const message = new BasicMessage({ content: 'hello' })

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
    const message = new TrustPingMessage({
      body: {
        responseRequested: false,
      },
    })

    test('Authcrypt pack/unpack works', async () => {
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
      expect(JsonTransformer.fromJSON(plainTextMessage.plaintextMessage, TrustPingMessage)).toEqual(message)
    })

    test('Anoncrypt pack/unpack works', async () => {
      // Create recipient keys only
      const recipientKey = await askarWallet.createKey({ keyType: KeyType.X25519 })

      const params: WalletPackOptions = {
        didCommVersion: DidCommMessageVersion.V2,
        recipientKeys: [recipientKey],
        senderKey: null,
      }

      const encryptedMessage = await askarWallet.pack(message.toJSON(), params)
      const plainTextMessage = await askarWallet.unpack(encryptedMessage)
      expect(JsonTransformer.fromJSON(plainTextMessage.plaintextMessage, TrustPingMessage)).toEqual(message)
    })
  })

  describe('DIDComm V2 test vectors', () => {
    function mockRecipientKey(key: { kid: string; value: any }) {
      const recipientKeys = {
        recipientAskarKey: AskarKey.fromJwk({ jwk: Jwk.fromJson(key.value) }),
        recipientKey: Key.fromJwk(key.value),
      }
      jest.spyOn(askarWallet, 'resolveRecipientKey').mockImplementation((kid) => {
        if (kid === key.kid) {
          return Promise.resolve(recipientKeys)
        } else {
          return Promise.resolve({ recipientAskarKey: undefined, recipientKey: undefined })
        }
      })
    }

    function resetRecipientKeyMock() {
      jest.spyOn(askarWallet, 'resolveRecipientKey').mockReset()
    }

    function mockSenderKey(key: { kid: string; value: any }) {
      const senderKeys = {
        senderAskarKey: AskarKey.fromJwk({ jwk: Jwk.fromJson(key.value) }),
        senderKey: Key.fromJwk(key.value),
      }
      jest.spyOn(askarWallet, 'resolveSenderKeys').mockImplementation((kid) => {
        if (kid === key.kid) {
          return senderKeys
        } else {
          return { senderAskarKey: undefined, senderKey: undefined }
        }
      })
    }

    function resetSenderKeyMock() {
      jest.spyOn(askarWallet, 'resolveSenderKeys').mockReset()
    }

    describe('Anocrypt', () => {
      test.each([bobX25519Secret1, bobX25519Secret2, bobX25519Secret3])(
        'Unpack anoncrypted EcdhEsX25519Xc20P test vector works',
        async (bobX25519Secret) => {
          const key = AskarKey.fromJwk({ jwk: Jwk.fromJson(bobX25519Secret.value) })
          await askarWallet.createKey({
            privateKey: Buffer.from(key.secretBytes),
            keyType: KeyType.X25519,
          })

          mockRecipientKey(bobX25519Secret)

          const unpackedMessage = await askarWallet.unpack(jweEcdhEsX25519Xc20P_1)
          expect(unpackedMessage.plaintextMessage).toEqual(message)

          resetRecipientKeyMock()
        }
      )

      test('Unpack fails when there is not recipient key in the wallet', async () => {
        return expect(() => askarWallet.unpack(jweEcdhEsX25519Xc20P_1)).rejects.toThrowError(AriesFrameworkError)
      })
    })

    describe('Authcrypt', () => {
      test.each([bobX25519Secret1, bobX25519Secret2, bobX25519Secret3])(
        'Unpack authcrypted Ecdh1PuA256CbcHs512 test vector works',
        async (bobX25519Secret) => {
          const key = AskarKey.fromJwk({ jwk: Jwk.fromJson(bobX25519Secret.value) })
          await askarWallet.createKey({
            privateKey: Buffer.from(key.secretBytes),
            keyType: KeyType.X25519,
          })

          mockSenderKey(aliceX25519Secret1)
          mockRecipientKey(bobX25519Secret)

          const unpackedMessage = await askarWallet.unpack(jweEcdh1PuA256CbcHs512_1)
          expect(unpackedMessage.plaintextMessage).toEqual(message)

          resetRecipientKeyMock()
          resetSenderKeyMock()
        }
      )

      test('Unpack fails when there is not recipient key in the wallet', async () => {
        mockSenderKey(aliceX25519Secret1)
        await expect(() => askarWallet.unpack(jweEcdh1PuA256CbcHs512_1)).rejects.toThrowError(AriesFrameworkError)
        resetSenderKeyMock()
      })

      test('Unpack fails when unable to resolve sender', async () => {
        await expect(() => askarWallet.unpack(jweEcdh1PuA256CbcHs512_1)).rejects.toThrowError(AriesFrameworkError)
      })
    })
  })
})
