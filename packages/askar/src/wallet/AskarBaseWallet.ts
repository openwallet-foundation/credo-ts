import type {
  EncryptedMessage,
  WalletConfig,
  WalletCreateKeyOptions,
  WalletSignOptions,
  UnpackedMessageContext,
  WalletVerifyOptions,
  Wallet,
  WalletConfigRekey,
  KeyPair,
  WalletExportImportConfig,
  Logger,
  SigningProviderRegistry,
} from '@credo-ts/core'
import type { KeyEntryObject, Session } from '@hyperledger/aries-askar-shared'

import {
  WalletKeyExistsError,
  isValidSeed,
  isValidPrivateKey,
  JsonTransformer,
  JsonEncoder,
  KeyType,
  Buffer,
  AriesFrameworkError,
  WalletError,
  Key,
  TypedArrayEncoder,
} from '@credo-ts/core'
import { KeyAlgs, CryptoBox, Store, Key as AskarKey, keyAlgFromString } from '@hyperledger/aries-askar-shared'
// eslint-disable-next-line import/order
import BigNumber from 'bn.js'

const isError = (error: unknown): error is Error => error instanceof Error

import { AskarErrorCode, isAskarError, isKeyTypeSupportedByAskar, keyTypesSupportedByAskar } from '../utils'

import { JweEnvelope, JweRecipient } from './JweEnvelope'

export abstract class AskarBaseWallet implements Wallet {
  protected _session?: Session

  protected logger: Logger
  protected signingKeyProviderRegistry: SigningProviderRegistry

  public constructor(logger: Logger, signingKeyProviderRegistry: SigningProviderRegistry) {
    this.logger = logger
    this.signingKeyProviderRegistry = signingKeyProviderRegistry
  }

  /**
   * Abstract methods that need to be implemented by subclasses
   */
  public abstract isInitialized: boolean
  public abstract isProvisioned: boolean
  public abstract create(walletConfig: WalletConfig): Promise<void>
  public abstract createAndOpen(walletConfig: WalletConfig): Promise<void>
  public abstract open(walletConfig: WalletConfig): Promise<void>
  public abstract rotateKey(walletConfig: WalletConfigRekey): Promise<void>
  public abstract close(): Promise<void>
  public abstract delete(): Promise<void>
  public abstract export(exportConfig: WalletExportImportConfig): Promise<void>
  public abstract import(walletConfig: WalletConfig, importConfig: WalletExportImportConfig): Promise<void>
  public abstract dispose(): void | Promise<void>
  public abstract profile: string

  public get session() {
    if (!this._session) {
      throw new AriesFrameworkError('No Wallet Session is opened')
    }

    return this._session
  }

  public get supportedKeyTypes() {
    const signingKeyProviderSupportedKeyTypes = this.signingKeyProviderRegistry.supportedKeyTypes

    return Array.from(new Set([...keyTypesSupportedByAskar, ...signingKeyProviderSupportedKeyTypes]))
  }

  /**
   * Create a key with an optional seed and keyType.
   * The keypair is also automatically stored in the wallet afterwards
   */
  public async createKey({ seed, privateKey, keyType }: WalletCreateKeyOptions): Promise<Key> {
    try {
      if (seed && privateKey) {
        throw new WalletError('Only one of seed and privateKey can be set')
      }

      if (seed && !isValidSeed(seed, keyType)) {
        throw new WalletError('Invalid seed provided')
      }

      if (privateKey && !isValidPrivateKey(privateKey, keyType)) {
        throw new WalletError('Invalid private key provided')
      }

      if (isKeyTypeSupportedByAskar(keyType)) {
        const algorithm = keyAlgFromString(keyType)

        // Create key
        let key: AskarKey | undefined
        try {
          const key = privateKey
            ? AskarKey.fromSecretBytes({ secretKey: privateKey, algorithm })
            : seed
            ? AskarKey.fromSeed({ seed, algorithm })
            : AskarKey.generate(algorithm)

          const keyPublicBytes = key.publicBytes
          // Store key
          await this.session.insertKey({ key, name: TypedArrayEncoder.toBase58(keyPublicBytes) })
          key.handle.free()
          return Key.fromPublicKey(keyPublicBytes, keyType)
        } catch (error) {
          key?.handle.free()
          // Handle case where key already exists
          if (isAskarError(error, AskarErrorCode.Duplicate)) {
            throw new WalletKeyExistsError('Key already exists')
          }

          // Otherwise re-throw error
          throw error
        }
      } else {
        // Check if there is a signing key provider for the specified key type.
        if (this.signingKeyProviderRegistry.hasProviderForKeyType(keyType)) {
          const signingKeyProvider = this.signingKeyProviderRegistry.getProviderForKeyType(keyType)

          const keyPair = await signingKeyProvider.createKeyPair({ seed, privateKey })
          await this.storeKeyPair(keyPair)
          return Key.fromPublicKeyBase58(keyPair.publicKeyBase58, keyType)
        }
        throw new WalletError(`Unsupported key type: '${keyType}'`)
      }
    } catch (error) {
      // If already instance of `WalletError`, re-throw
      if (error instanceof WalletError) throw error

      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error', { cause: error })
      }
      throw new WalletError(`Error creating key with key type '${keyType}': ${error.message}`, { cause: error })
    }
  }

  /**
   * sign a Buffer with an instance of a Key class
   *
   * @param data Buffer The data that needs to be signed
   * @param key Key The key that is used to sign the data
   *
   * @returns A signature for the data
   */
  public async sign({ data, key }: WalletSignOptions): Promise<Buffer> {
    let keyEntry: KeyEntryObject | null | undefined
    try {
      if (isKeyTypeSupportedByAskar(key.keyType)) {
        if (!TypedArrayEncoder.isTypedArray(data)) {
          throw new WalletError(`Currently not supporting signing of multiple messages`)
        }
        keyEntry = await this.session.fetchKey({ name: key.publicKeyBase58 })

        if (!keyEntry) {
          throw new WalletError('Key entry not found')
        }

        const signed = keyEntry.key.signMessage({ message: data as Buffer })

        keyEntry.key.handle.free()

        return Buffer.from(signed)
      } else {
        // Check if there is a signing key provider for the specified key type.
        if (this.signingKeyProviderRegistry.hasProviderForKeyType(key.keyType)) {
          const signingKeyProvider = this.signingKeyProviderRegistry.getProviderForKeyType(key.keyType)

          const keyPair = await this.retrieveKeyPair(key.publicKeyBase58)
          const signed = await signingKeyProvider.sign({
            data,
            privateKeyBase58: keyPair.privateKeyBase58,
            publicKeyBase58: key.publicKeyBase58,
          })

          return signed
        }
        throw new WalletError(`Unsupported keyType: ${key.keyType}`)
      }
    } catch (error) {
      keyEntry?.key.handle.free()
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error', { cause: error })
      }
      throw new WalletError(`Error signing data with verkey ${key.publicKeyBase58}. ${error.message}`, { cause: error })
    }
  }

  /**
   * Verify the signature with the data and the used key
   *
   * @param data Buffer The data that has to be confirmed to be signed
   * @param key Key The key that was used in the signing process
   * @param signature Buffer The signature that was created by the signing process
   *
   * @returns A boolean whether the signature was created with the supplied data and key
   *
   * @throws {WalletError} When it could not do the verification
   * @throws {WalletError} When an unsupported keytype is used
   */
  public async verify({ data, key, signature }: WalletVerifyOptions): Promise<boolean> {
    let askarKey: AskarKey | undefined
    try {
      if (isKeyTypeSupportedByAskar(key.keyType)) {
        if (!TypedArrayEncoder.isTypedArray(data)) {
          throw new WalletError(`Currently not supporting verification of multiple messages`)
        }

        const askarKey = AskarKey.fromPublicBytes({
          algorithm: keyAlgFromString(key.keyType),
          publicKey: key.publicKey,
        })
        const verified = askarKey.verifySignature({ message: data as Buffer, signature })
        askarKey.handle.free()
        return verified
      } else {
        // Check if there is a signing key provider for the specified key type.
        if (this.signingKeyProviderRegistry.hasProviderForKeyType(key.keyType)) {
          const signingKeyProvider = this.signingKeyProviderRegistry.getProviderForKeyType(key.keyType)

          const signed = await signingKeyProvider.verify({
            data,
            signature,
            publicKeyBase58: key.publicKeyBase58,
          })

          return signed
        }
        throw new WalletError(`Unsupported keyType: ${key.keyType}`)
      }
    } catch (error) {
      askarKey?.handle.free()
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error', { cause: error })
      }
      throw new WalletError(`Error verifying signature of data signed with verkey ${key.publicKeyBase58}`, {
        cause: error,
      })
    }
  }

  /**
   * Pack a message using DIDComm V1 algorithm
   *
   * @param payload message to send
   * @param recipientKeys array containing recipient keys in base58
   * @param senderVerkey sender key in base58
   * @returns JWE Envelope to send
   */
  public async pack(
    payload: Record<string, unknown>,
    recipientKeys: string[],
    senderVerkey?: string // in base58
  ): Promise<EncryptedMessage> {
    let cek: AskarKey | undefined
    let senderKey: KeyEntryObject | null | undefined
    let senderExchangeKey: AskarKey | undefined

    try {
      cek = AskarKey.generate(KeyAlgs.Chacha20C20P)

      senderKey = senderVerkey ? await this.session.fetchKey({ name: senderVerkey }) : undefined
      if (senderVerkey && !senderKey) {
        throw new WalletError(`Unable to pack message. Sender key ${senderVerkey} not found in wallet.`)
      }

      senderExchangeKey = senderKey ? senderKey.key.convertkey({ algorithm: KeyAlgs.X25519 }) : undefined

      const recipients: JweRecipient[] = []

      for (const recipientKey of recipientKeys) {
        let targetExchangeKey: AskarKey | undefined
        try {
          targetExchangeKey = AskarKey.fromPublicBytes({
            publicKey: Key.fromPublicKeyBase58(recipientKey, KeyType.Ed25519).publicKey,
            algorithm: KeyAlgs.Ed25519,
          }).convertkey({ algorithm: KeyAlgs.X25519 })

          if (senderVerkey && senderExchangeKey) {
            const encryptedSender = CryptoBox.seal({
              recipientKey: targetExchangeKey,
              message: Buffer.from(senderVerkey),
            })
            const nonce = CryptoBox.randomNonce()
            const encryptedCek = CryptoBox.cryptoBox({
              recipientKey: targetExchangeKey,
              senderKey: senderExchangeKey,
              message: cek.secretBytes,
              nonce,
            })

            recipients.push(
              new JweRecipient({
                encryptedKey: encryptedCek,
                header: {
                  kid: recipientKey,
                  sender: TypedArrayEncoder.toBase64URL(encryptedSender),
                  iv: TypedArrayEncoder.toBase64URL(nonce),
                },
              })
            )
          } else {
            const encryptedCek = CryptoBox.seal({
              recipientKey: targetExchangeKey,
              message: cek.secretBytes,
            })
            recipients.push(
              new JweRecipient({
                encryptedKey: encryptedCek,
                header: {
                  kid: recipientKey,
                },
              })
            )
          }
        } finally {
          targetExchangeKey?.handle.free()
        }
      }

      const protectedJson = {
        enc: 'xchacha20poly1305_ietf',
        typ: 'JWM/1.0',
        alg: senderVerkey ? 'Authcrypt' : 'Anoncrypt',
        recipients: recipients.map((item) => JsonTransformer.toJSON(item)),
      }

      const { ciphertext, tag, nonce } = cek.aeadEncrypt({
        message: Buffer.from(JSON.stringify(payload)),
        aad: Buffer.from(JsonEncoder.toBase64URL(protectedJson)),
      }).parts

      const envelope = new JweEnvelope({
        ciphertext: TypedArrayEncoder.toBase64URL(ciphertext),
        iv: TypedArrayEncoder.toBase64URL(nonce),
        protected: JsonEncoder.toBase64URL(protectedJson),
        tag: TypedArrayEncoder.toBase64URL(tag),
      }).toJson()

      return envelope as EncryptedMessage
    } finally {
      cek?.handle.free()
      senderKey?.key.handle.free()
      senderExchangeKey?.handle.free()
    }
  }

  /**
   * Unpacks a JWE Envelope coded using DIDComm V1 algorithm
   *
   * @param messagePackage JWE Envelope
   * @returns UnpackedMessageContext with plain text message, sender key and recipient key
   */
  public async unpack(messagePackage: EncryptedMessage): Promise<UnpackedMessageContext> {
    const protectedJson = JsonEncoder.fromBase64(messagePackage.protected)

    const alg = protectedJson.alg
    if (!['Anoncrypt', 'Authcrypt'].includes(alg)) {
      throw new WalletError(`Unsupported pack algorithm: ${alg}`)
    }

    const recipients = []

    for (const recip of protectedJson.recipients) {
      const kid = recip.header.kid
      if (!kid) {
        throw new WalletError('Blank recipient key')
      }
      const sender = recip.header.sender ? TypedArrayEncoder.fromBase64(recip.header.sender) : undefined
      const iv = recip.header.iv ? TypedArrayEncoder.fromBase64(recip.header.iv) : undefined
      if (sender && !iv) {
        throw new WalletError('Missing IV')
      } else if (!sender && iv) {
        throw new WalletError('Unexpected IV')
      }
      recipients.push({
        kid,
        sender,
        iv,
        encrypted_key: TypedArrayEncoder.fromBase64(recip.encrypted_key),
      })
    }

    let payloadKey, senderKey, recipientKey

    for (const recipient of recipients) {
      let recipientKeyEntry: KeyEntryObject | null | undefined
      let sender_x: AskarKey | undefined
      let recip_x: AskarKey | undefined

      try {
        recipientKeyEntry = await this.session.fetchKey({ name: recipient.kid })
        if (recipientKeyEntry) {
          const recip_x = recipientKeyEntry.key.convertkey({ algorithm: KeyAlgs.X25519 })
          recipientKey = recipient.kid

          if (recipient.sender && recipient.iv) {
            senderKey = TypedArrayEncoder.toUtf8String(
              CryptoBox.sealOpen({
                recipientKey: recip_x,
                ciphertext: recipient.sender,
              })
            )
            const sender_x = AskarKey.fromPublicBytes({
              algorithm: KeyAlgs.Ed25519,
              publicKey: TypedArrayEncoder.fromBase58(senderKey),
            }).convertkey({ algorithm: KeyAlgs.X25519 })

            payloadKey = CryptoBox.open({
              recipientKey: recip_x,
              senderKey: sender_x,
              message: recipient.encrypted_key,
              nonce: recipient.iv,
            })
          } else {
            payloadKey = CryptoBox.sealOpen({ ciphertext: recipient.encrypted_key, recipientKey: recip_x })
          }
          break
        }
      } finally {
        recipientKeyEntry?.key.handle.free()
        sender_x?.handle.free()
        recip_x?.handle.free()
      }
    }
    if (!payloadKey) {
      throw new WalletError('No corresponding recipient key found')
    }

    if (!senderKey && alg === 'Authcrypt') {
      throw new WalletError('Sender public key not provided for Authcrypt')
    }

    let cek: AskarKey | undefined
    try {
      cek = AskarKey.fromSecretBytes({ algorithm: KeyAlgs.Chacha20C20P, secretKey: payloadKey })
      const message = cek.aeadDecrypt({
        ciphertext: TypedArrayEncoder.fromBase64(messagePackage.ciphertext),
        nonce: TypedArrayEncoder.fromBase64(messagePackage.iv),
        tag: TypedArrayEncoder.fromBase64(messagePackage.tag),
        aad: TypedArrayEncoder.fromString(messagePackage.protected),
      })
      return {
        plaintextMessage: JsonEncoder.fromBuffer(message),
        senderKey,
        recipientKey,
      }
    } finally {
      cek?.handle.free()
    }
  }

  public async generateNonce(): Promise<string> {
    try {
      // generate an 80-bit nonce suitable for AnonCreds proofs
      const nonce = CryptoBox.randomNonce().slice(0, 10)
      return new BigNumber(nonce).toString()
    } catch (error) {
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error', { cause: error })
      }
      throw new WalletError('Error generating nonce', { cause: error })
    }
  }

  public async generateWalletKey() {
    try {
      return Store.generateRawKey()
    } catch (error) {
      throw new WalletError('Error generating wallet key', { cause: error })
    }
  }

  private async retrieveKeyPair(publicKeyBase58: string): Promise<KeyPair> {
    try {
      const entryObject = await this.session.fetch({ category: 'KeyPairRecord', name: `key-${publicKeyBase58}` })

      if (entryObject?.value) {
        return JsonEncoder.fromString(entryObject?.value as string) as KeyPair
      } else {
        throw new WalletError(`No content found for record with public key: ${publicKeyBase58}`)
      }
    } catch (error) {
      throw new WalletError('Error retrieving KeyPair record', { cause: error })
    }
  }

  private async storeKeyPair(keyPair: KeyPair): Promise<void> {
    try {
      await this.session.insert({
        category: 'KeyPairRecord',
        name: `key-${keyPair.publicKeyBase58}`,
        value: JSON.stringify(keyPair),
        tags: {
          keyType: keyPair.keyType,
        },
      })
    } catch (error) {
      if (isAskarError(error, AskarErrorCode.Duplicate)) {
        throw new WalletKeyExistsError('Key already exists')
      }
      throw new WalletError('Error saving KeyPair record', { cause: error })
    }
  }
}
