import type { CreateKeyPairOptions, KeyPair, SignOptions, SigningProvider, VerifyOptions } from '@credo-ts/core'

import { Buffer, KeyType, SigningProviderError, TypedArrayEncoder, injectable } from '@credo-ts/core'
import { bls12381toBbs, generateBls12381G2KeyPair, sign, verify } from '@mattrglobal/bbs-signatures'

/**
 * This will be extracted to the bbs package.
 */
@injectable()
export class Bls12381g2SigningProvider implements SigningProvider {
  public readonly keyType = KeyType.Bls12381g2

  /**
   * Create a KeyPair with type Bls12381g2
   *
   * @throws {SigningProviderError} When a key could not be created
   */
  public async createKeyPair({ seed, privateKey }: CreateKeyPairOptions): Promise<KeyPair> {
    if (privateKey) {
      throw new SigningProviderError('Cannot create keypair from private key')
    }

    const blsKeyPair = await generateBls12381G2KeyPair(seed)

    return {
      keyType: KeyType.Bls12381g2,
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
   * @throws {SigningProviderError} When there are no supplied messages
   */
  public async sign({ data, publicKeyBase58, privateKeyBase58 }: SignOptions): Promise<Buffer> {
    if (data.length === 0) throw new SigningProviderError('Unable to create a signature without any messages')
    // Check if it is a single message or list and if it is a single message convert it to a list
    const normalizedMessages = (TypedArrayEncoder.isTypedArray(data) ? [data as Buffer] : data) as Buffer[]

    // Get the Uint8Array variant of all the messages
    const messageBuffers = normalizedMessages.map((m) => Uint8Array.from(m))

    const publicKey = TypedArrayEncoder.fromBase58(publicKeyBase58)
    const privateKey = TypedArrayEncoder.fromBase58(privateKeyBase58)

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
   * Verify an arbitrary amount of messages with their signature created with their key pair
   *
   * @param publicKey Buffer The public key used to sign the messages
   * @param messages Buffer[] The messages that have to be verified if they are signed
   * @param signature Buffer The signature that has to be verified if it was created with the messages and public key
   *
   * @returns A boolean whether the signature is create with the public key over the messages
   *
   * @throws {SigningProviderError} When the message list is empty
   * @throws {SigningProviderError} When the verification process failed
   */
  public async verify({ data, publicKeyBase58, signature }: VerifyOptions): Promise<boolean> {
    if (data.length === 0) throw new SigningProviderError('Unable to create a signature without any messages')
    // Check if it is a single message or list and if it is a single message convert it to a list
    const normalizedMessages = (TypedArrayEncoder.isTypedArray(data) ? [data as Buffer] : data) as Buffer[]

    const publicKey = TypedArrayEncoder.fromBase58(publicKeyBase58)

    // Get the Uint8Array variant of all the messages
    const messageBuffers = normalizedMessages.map((m) => Uint8Array.from(m))

    const bbsKeyPair = await bls12381toBbs({
      keyPair: { publicKey: Uint8Array.from(publicKey) },
      messageCount: normalizedMessages.length,
    })

    // Verify the signature against the messages with their public key
    const { verified, error } = await verify({ signature, messages: messageBuffers, publicKey: bbsKeyPair.publicKey })

    // If the messages could not be verified and an error occurred
    if (!verified && error) {
      throw new SigningProviderError(`Could not verify the signature against the messages: ${error}`)
    }

    return verified
  }
}
