import type { CreateKeyOptions } from '../wallet'
import type { BbsSignRequest, BlsKeyPair as _BlsKeyPair } from '@mattrglobal/bbs-signatures'

import {
  bls12381toBbs,
  generateBls12381G2KeyPair,
  generateBls12381G1KeyPair,
  sign,
  verify,
} from '@mattrglobal/bbs-signatures'

import { TypedArrayEncoder } from '../utils/TypedArrayEncoder'
import { Buffer } from '../utils/buffer'
import { WalletError } from '../wallet/error'

import { KeyType } from './KeyType'

export interface BlsKeyPair {
  publicKeyBase58: string
  privateKeyBase58: string
  keyType: Exclude<KeyType, KeyType.Ed25519 | KeyType.X25519>
}

interface BbsCreateKeyOptions extends CreateKeyOptions {
  keyType: Exclude<KeyType, KeyType.X25519 | KeyType.Ed25519 | KeyType.Bls12381g1g2>
}

interface BbsSignOptions {
  messages: Buffer | Buffer[]
  publicKey: Buffer
  privateKey: Buffer
}

interface BbsVerifyOptions {
  publicKey: Buffer
  signature: Buffer
  messages: Buffer | Buffer[]
}

export class BbsService {
  /**
   * Create an instance of a Key class for the following key types:
   *  - Bls12381g1
   *  - Bls12381g2
   *
   * @param keyType KeyType The type of key to be created (see above for the accepted types)
   *
   * @returns A Key class with the public key and key type
   *
   * @throws {WalletError} When a key could not be created
   * @throws {WalletError} When the method is called with an invalid keytype
   */
  public static async createKey({ keyType, seed }: BbsCreateKeyOptions): Promise<BlsKeyPair> {
    // Generate bytes from the seed as required by the bbs-signatures libraries
    const seedBytes = seed ? TypedArrayEncoder.fromString(seed) : undefined

    // Temporary keypair holder
    let blsKeyPair: Required<_BlsKeyPair>

    switch (keyType) {
      case KeyType.Bls12381g1:
        // Generate a bls12-381G1 keypair
        blsKeyPair = await generateBls12381G1KeyPair(seedBytes)
        break
      case KeyType.Bls12381g2:
        // Generate a bls12-381G2 keypair
        blsKeyPair = await generateBls12381G2KeyPair(seedBytes)
        break
      default:
        // additional check. Should never be hit as this function will only be called from a place where
        // a key type check already happened.
        throw new WalletError(`Cannot create key with the BbsService for key type: ${keyType}`)
    }

    return {
      keyType,
      publicKeyBase58: TypedArrayEncoder.toBase58(blsKeyPair.publicKey),
      privateKeyBase58: TypedArrayEncoder.toBase58(blsKeyPair.secretKey),
    }
  }

  /**
   * Sign an arbitrary amount of messages, in byte form, with a keypair
   *
   * @param messages Buffer[] List of messages in Buffer form
   * @param publicKey Buffer Publickey required for the signing process
   * @param privateKey Buffer PrivateKey required for the signing process
   *
   * @returns A Buffer containing the signature of the messages
   *
   * @throws {WalletError} When there are no supplied messages
   */
  public static async sign({ messages, publicKey, privateKey }: BbsSignOptions): Promise<Buffer> {
    if (messages.length === 0) throw new WalletError('Unable to create a signature without any messages')
    // Check if it is a single message or list and if it is a single message convert it to a list
    const normalizedMessages = (typeof messages[0] === 'number' ? [messages as Buffer] : messages) as Buffer[]

    // Get the Uint8Array variant of all the messages
    const messageBuffers = normalizedMessages.map((m) => Uint8Array.from(m))

    const bbsKeyPair = await bls12381toBbs({
      keyPair: { publicKey: Uint8Array.from(publicKey), secretKey: Uint8Array.from(privateKey) },
      messageCount: normalizedMessages.length,
    })

    // Sign the messages via the keyPair
    const signature = await sign({
      keyPair: bbsKeyPair,
      messages: messageBuffers,
    })

    // Convert the Uint8Array signature to a Buffer type
    return Buffer.from(signature)
  }

  /**
   * Verify an arbitrary amount of messages with their signature created by with their public key
   *
   * @param publicKey Buffer The public key used to sign the messages
   * @param messages Buffer[] The messages that have to be verified if they are signed
   * @param signature Buffer The signature that has to be verified if it was created with the messages and public key
   *
   * @returns A boolean whether the signature is create with the public key over the messages
   *
   * @throws {WalletError} When the message list is empty
   * @throws {WalletError} When the verification process failed
   */
  public static async verify({ signature, messages, publicKey }: BbsVerifyOptions): Promise<boolean> {
    if (messages.length === 0) throw new WalletError('Unable to verify without any messages')
    // Check if it is a single message or list and if it is a single message convert it to a list
    if (typeof messages[0] === 'number') messages = [messages as Buffer]

    // Get the Uint8Array variant of all the messages
    const messageBuffers = (messages as Buffer[]).map(Uint8Array.from)

    // Verify the signature against the messages with their public key
    const { verified, error } = await verify({ signature, messages: messageBuffers, publicKey })

    // If the messages could not be verified and an error occured
    if (!verified && error) {
      throw new WalletError(`Could not verify the signature against the messages: ${error}`)
    }

    return verified
  }
}
