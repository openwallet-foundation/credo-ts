import type {
  EncryptedMessage,
  WalletConfig,
  WalletCreateKeyOptions,
  WalletSignOptions,
  UnpackedMessageContext,
  WalletVerifyOptions,
  Wallet,
} from '@credo-ts/core'

import { CryptoBox, Store, Key as AskarKey, keyAlgFromString } from '@hyperledger/aries-askar-nodejs'
import BigNumber from 'bn.js'

import { convertToAskarKeyBackend } from '../packages/askar/src/utils/askarKeyBackend'
import { didcommV1Pack, didcommV1Unpack } from '../packages/askar/src/wallet/didcommV1'

import {
  JsonEncoder,
  WalletNotFoundError,
  injectable,
  isValidSeed,
  isValidPrivateKey,
  KeyType,
  Buffer,
  CredoError,
  WalletError,
  Key,
  TypedArrayEncoder,
  KeyBackend,
} from '@credo-ts/core'

const inMemoryWallets: InMemoryWallets = {}

const isError = (error: unknown): error is Error => error instanceof Error

interface InMemoryKey {
  publicKeyBytes: Uint8Array
  secretKeyBytes: Uint8Array
  keyType: KeyType
}

interface InMemoryKeys {
  [id: string]: InMemoryKey
}

interface InMemoryWallets {
  [id: string]: {
    keys: InMemoryKeys
    creationDate: Date
  }
}

@injectable()
export class InMemoryWallet implements Wallet {
  // activeWalletId can be set even if wallet is closed. So make sure to also look at
  // isInitialized to see if the wallet is actually open
  public activeWalletId?: string

  public get inMemoryWallets() {
    return inMemoryWallets
  }
  /**
   * Abstract methods that need to be implemented by subclasses
   */
  public isInitialized = false
  public isProvisioned = false

  public get supportedKeyTypes() {
    return [KeyType.Ed25519, KeyType.P256, KeyType.P384, KeyType.K256]
  }

  private getInMemoryKeys(): InMemoryKeys {
    if (!this.activeWalletId || !this.isInitialized) {
      throw new WalletError('No active wallet')
    }

    if (!this.inMemoryWallets[this.activeWalletId]) {
      throw new WalletError('wallet does not exist')
    }

    return this.inMemoryWallets[this.activeWalletId].keys
  }

  public async create(walletConfig: WalletConfig) {
    if (this.inMemoryWallets[walletConfig.id]) {
      throw new WalletError('Wallet already exists')
    }

    this.inMemoryWallets[walletConfig.id] = {
      keys: {},
      creationDate: new Date(),
    }
  }

  public async createAndOpen(walletConfig: WalletConfig) {
    await this.create(walletConfig)
    await this.open(walletConfig)
  }

  public async open(walletConfig: WalletConfig) {
    if (this.isInitialized) {
      throw new WalletError('A wallet is already open')
    }

    if (!this.inMemoryWallets[walletConfig.id]) {
      throw new WalletNotFoundError('Wallet does not exist', { walletType: 'InMemoryWallet' })
    }

    this.activeWalletId = walletConfig.id
    this.isProvisioned = true
    this.isInitialized = true
  }

  public rotateKey(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public async close() {
    this.isInitialized = false
  }

  public async delete() {
    if (!this.activeWalletId) {
      throw new WalletError('wallet is not provisioned')
    }

    delete this.inMemoryWallets[this.activeWalletId]
    this.activeWalletId = undefined
    this.isProvisioned = false
  }

  public async export() {
    throw new Error('Method not implemented.')
  }

  public async import() {
    throw new Error('Method not implemented.')
  }

  public async dispose() {
    this.isInitialized = false
  }

  /**
   * Create a key with an optional seed and keyType.
   * The keypair is also automatically stored in the wallet afterwards
   */
  public async createKey({
    seed,
    privateKey,
    keyType,
    keyBackend = KeyBackend.Software,
  }: WalletCreateKeyOptions): Promise<Key> {
    try {
      if (keyBackend !== KeyBackend.Software) {
        throw new WalletError('Only Software backend is allowed for the in-memory wallet')
      }
      if (seed && privateKey) {
        throw new WalletError('Only one of seed and privateKey can be set')
      }

      if (seed && !isValidSeed(seed, keyType)) {
        throw new WalletError('Invalid seed provided')
      }

      if (privateKey && !isValidPrivateKey(privateKey, keyType)) {
        throw new WalletError('Invalid private key provided')
      }

      if (!this.supportedKeyTypes.includes(keyType)) {
        throw new WalletError(`Unsupported key type: '${keyType}'`)
      }

      const algorithm = keyAlgFromString(keyType)

      // Create key
      let key: AskarKey | undefined
      try {
        key = privateKey
          ? AskarKey.fromSecretBytes({ secretKey: privateKey, algorithm })
          : seed
          ? AskarKey.fromSeed({ seed, algorithm })
          : AskarKey.generate(algorithm, convertToAskarKeyBackend(keyBackend))

        const keyPublicBytes = key.publicBytes
        // Store key
        this.getInMemoryKeys()[TypedArrayEncoder.toBase58(keyPublicBytes)] = {
          publicKeyBytes: keyPublicBytes,
          secretKeyBytes: key.secretBytes,
          keyType,
        }

        return Key.fromPublicKey(keyPublicBytes, keyType)
      } finally {
        key?.handle.free()
      }
    } catch (error) {
      // If already instance of `WalletError`, re-throw
      if (error instanceof WalletError) throw error

      if (!isError(error)) {
        throw new CredoError('Attempted to throw error, but it was not of type Error', { cause: error })
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
    const inMemoryKey = this.getInMemoryKeys()[key.publicKeyBase58]
    if (!inMemoryKey) {
      throw new WalletError(`Key not found in wallet`)
    }

    if (!TypedArrayEncoder.isTypedArray(data)) {
      throw new WalletError(`Currently not supporting signing of multiple messages`)
    }

    let askarKey: AskarKey | undefined
    try {
      const inMemoryKey = this.getInMemoryKeys()[key.publicKeyBase58]
      askarKey = AskarKey.fromSecretBytes({
        algorithm: keyAlgFromString(inMemoryKey.keyType),
        secretKey: inMemoryKey.secretKeyBytes,
      })

      const signed = askarKey.signMessage({ message: data as Buffer })

      return Buffer.from(signed)
    } finally {
      askarKey?.handle.free()
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
    if (!TypedArrayEncoder.isTypedArray(data)) {
      throw new WalletError(`Currently not supporting signing of multiple messages`)
    }

    let askarKey: AskarKey | undefined
    try {
      askarKey = AskarKey.fromPublicBytes({
        algorithm: keyAlgFromString(key.keyType),
        publicKey: key.publicKey,
      })
      return askarKey.verifySignature({ message: data as Buffer, signature })
    } finally {
      askarKey?.handle.free()
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
    const senderKey = senderVerkey ? this.getInMemoryKeys()[senderVerkey] : undefined

    if (senderVerkey && !senderKey) {
      throw new WalletError(`Sender key not found`)
    }

    const askarSenderKey = senderKey
      ? AskarKey.fromSecretBytes({
          algorithm: keyAlgFromString(senderKey.keyType),
          secretKey: senderKey.secretKeyBytes,
        })
      : undefined

    try {
      const envelope = didcommV1Pack(payload, recipientKeys, askarSenderKey)
      return envelope
    } finally {
      askarSenderKey?.handle.free()
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recipientKids: string[] = protectedJson.recipients.map((r: any) => r.header.kid)

    for (const recipientKid of recipientKids) {
      const recipientKey = this.getInMemoryKeys()[recipientKid]
      const recipientAskarKey = recipientKey
        ? AskarKey.fromSecretBytes({
            algorithm: keyAlgFromString(recipientKey.keyType),
            secretKey: recipientKey.secretKeyBytes,
          })
        : undefined
      try {
        if (recipientAskarKey) {
          const unpacked = didcommV1Unpack(messagePackage, recipientAskarKey)
          return unpacked
        }
      } finally {
        recipientAskarKey?.handle.free()
      }
    }

    throw new WalletError('No corresponding recipient key found')
  }

  public async generateNonce(): Promise<string> {
    try {
      // generate an 80-bit nonce suitable for AnonCreds proofs
      const nonce = CryptoBox.randomNonce().slice(0, 10)
      return new BigNumber(nonce).toString()
    } catch (error) {
      if (!isError(error)) {
        throw new CredoError('Attempted to throw error, but it was not of type Error', { cause: error })
      }
      throw new WalletError('Error generating nonce', { cause: error })
    }
  }

  public getRandomValues(length: number): Uint8Array {
    try {
      const buffer = new Uint8Array(length)
      const CBOX_NONCE_LENGTH = 24

      const genCount = Math.ceil(length / CBOX_NONCE_LENGTH)
      const buf = new Uint8Array(genCount * CBOX_NONCE_LENGTH)
      for (let i = 0; i < genCount; i++) {
        const randomBytes = CryptoBox.randomNonce()
        buf.set(randomBytes, CBOX_NONCE_LENGTH * i)
      }
      buffer.set(buf.subarray(0, length))

      return buffer
    } catch (error) {
      if (!isError(error)) {
        throw new CredoError('Attempted to throw error, but it was not of type Error', { cause: error })
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
}
