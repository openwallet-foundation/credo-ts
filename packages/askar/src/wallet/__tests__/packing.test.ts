import type { WalletConfig, WalletPackOptions, WalletUnpackOptions } from '@aries-framework/core'

import {
  BasicMessage,
  DidCommMessageVersion,
  JsonTransformer,
  KeyDerivationMethod,
  KeyProviderRegistry,
  KeyType,
  Key,
  AriesFrameworkError,
  DidKey,
  DidDocument,
} from '@aries-framework/core'
import { Jwk, Key as AskarKey } from '@hyperledger/aries-askar-shared'

import { describeRunInNodeVersion } from '../../../../../tests/runInVersion'
import { TrustPingMessage } from '../../../../core/src/modules/connections/protocols/trust-ping/v2'
import { agentDependencies } from '../../../../core/tests/helpers'
import testLogger from '../../../../core/tests/logger'
import { AskarWallet } from '../AskarWallet'

import {
  aliceDidDocument,
  bobDidDocument,
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

  async function createDidDocument(): Promise<DidDocument> {
    const key = await askarWallet.createKey({ keyType: KeyType.X25519 })
    return new DidKey(key).didDocument
  }

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
      const senderDidDocument = await createDidDocument()
      const recipientDidDocument = await createDidDocument()

      const packParams: WalletPackOptions = {
        didCommVersion: DidCommMessageVersion.V2,
        recipientDidDocuments: [recipientDidDocument],
        senderDidDocument,
      }
      const encryptedMessage = await askarWallet.pack(message.toJSON(), packParams)

      const unpackParams: WalletUnpackOptions = {
        senderDidDocument,
        recipientDidDocuments: [recipientDidDocument],
      }
      const plainTextMessage = await askarWallet.unpack(encryptedMessage, unpackParams)

      expect(JsonTransformer.fromJSON(plainTextMessage.plaintextMessage, TrustPingMessage)).toEqual(message)
    })

    test('Anoncrypt pack/unpack works', async () => {
      // Create recipient keys only
      const recipientDidDocument = await createDidDocument()

      const packParams: WalletPackOptions = {
        didCommVersion: DidCommMessageVersion.V2,
        recipientDidDocuments: [recipientDidDocument],
        senderDidDocument: null,
      }
      const encryptedMessage = await askarWallet.pack(message.toJSON(), packParams)

      const unpackParams: WalletUnpackOptions = {
        recipientDidDocuments: [recipientDidDocument],
      }
      const plainTextMessage = await askarWallet.unpack(encryptedMessage, unpackParams)

      expect(JsonTransformer.fromJSON(plainTextMessage.plaintextMessage, TrustPingMessage)).toEqual(message)
    })
  })

  describe('DIDComm V2 test vectors', () => {
    function mockRecipientKey(key: { kid: string; value: any }) {
      const recipientKeys = {
        recipientAskarKey: AskarKey.fromJwk({ jwk: Jwk.fromJson(key.value) }),
        recipientKey: Key.fromJwk(key.value),
      }
      jest.spyOn(askarWallet, 'resolveRecipientKey').mockImplementation(({ kid }) => {
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

    describe('Anocrypt', () => {
      const unpackParams = {
        // @ts-ignore
        recipientDidDocuments: [new DidDocument(bobDidDocument)],
        senderDidDocument: undefined,
      }

      test.each([bobX25519Secret1, bobX25519Secret2, bobX25519Secret3])(
        'Unpack anoncrypted EcdhEsX25519Xc20P test vector works',
        async (bobX25519Secret) => {
          mockRecipientKey(bobX25519Secret)

          const unpackedMessage = await askarWallet.unpack(jweEcdhEsX25519Xc20P_1, unpackParams)
          expect(unpackedMessage.plaintextMessage).toEqual(message)

          resetRecipientKeyMock()
        }
      )

      test('Unpack fails when there is not recipient key in the wallet', async () => {
        return expect(() => askarWallet.unpack(jweEcdhEsX25519Xc20P_1, unpackParams)).rejects.toThrowError(
          AriesFrameworkError
        )
      })
    })

    describe('Authcrypt', () => {
      const unpackParams = {
        // @ts-ignore
        recipientDidDocuments: [new DidDocument(bobDidDocument)],
        // @ts-ignore
        senderDidDocument: new DidDocument(aliceDidDocument),
      }

      test.each([bobX25519Secret1, bobX25519Secret2, bobX25519Secret3])(
        'Unpack authcrypted Ecdh1PuA256CbcHs512 test vector works',
        async (bobX25519Secret) => {
          mockRecipientKey(bobX25519Secret)

          const unpackedMessage = await askarWallet.unpack(jweEcdh1PuA256CbcHs512_1, unpackParams)
          expect(unpackedMessage.plaintextMessage).toEqual(message)

          resetRecipientKeyMock()
        }
      )

      test('Unpack fails when there is not recipient key in the wallet', async () => {
        jest
          .spyOn(askarWallet, 'resolveRecipientKey')
          .mockReturnValue(Promise.resolve({ recipientAskarKey: undefined, recipientKey: undefined }))

        await expect(() => askarWallet.unpack(jweEcdh1PuA256CbcHs512_1, unpackParams)).rejects.toThrowError(
          AriesFrameworkError
        )

        jest.spyOn(askarWallet, 'resolveRecipientKey').mockReset()
      })

      test('Unpack fails when unable to resolve sender', async () => {
        jest
          .spyOn(askarWallet, 'resolveSenderKeys')
          .mockReturnValue({ senderAskarKey: undefined, senderKey: undefined })

        await expect(() => askarWallet.unpack(jweEcdh1PuA256CbcHs512_1, unpackParams)).rejects.toThrowError(
          AriesFrameworkError
        )

        jest.spyOn(askarWallet, 'resolveSenderKeys').mockReset()
      })
    })
  })
})
