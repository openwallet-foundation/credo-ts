import type { CreateKeyOptions, SignOptions, VerifyOptions } from '../wallet'
import type { BlsKeyPair } from '@mattrglobal/bbs-signatures'

import { generateBls12381G2KeyPair, generateBls12381G1KeyPair } from '@mattrglobal/bbs-signatures'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { KeyPairRecord } from '../storage/keyPair'
import { KeyPairRepository } from '../storage/keyPair/KeyPairRepository'
import { BufferEncoder } from '../utils'
import { Buffer } from '../utils/buffer'
import { WalletError } from '../wallet/error'

import { Key } from './Key'
import { KeyType } from './KeyType'

@scoped(Lifecycle.ContainerScoped)
export class BbsService {
  private keyPairRepository: KeyPairRepository

  public constructor(@inject(Symbol('KeyPairRepository')) keyPairRepository: KeyPairRepository) {
    this.keyPairRepository = keyPairRepository
  }

  /**
   * Create an instance of a Key class for the following key types:
   *  - Bls12381g1
   *  - Bls12381g2
   *
   * @returns A Key class with the public key and key type
   *
   * @throws {WalletError} When a key could not be created
   * @throws {WalletError} When the method is called with an invalid keytype
   */
  public async createKey({ keyType, seed }: CreateKeyOptions): Promise<Key> {
    // Generate bytes from the seed as required by the bbs-signatures libraries
    const seedBytes = seed ? BufferEncoder.fromString(seed) : undefined

    // Temporary keypair holder
    let blsKeyPair: Required<BlsKeyPair>

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
    // Instantiate a keyPair record
    const keyPairRecord = new KeyPairRecord({
      keyType,
      publicKey: blsKeyPair.publicKey,
      privateKey: blsKeyPair.secretKey,
    })

    //Save the keyPair record in the keyPairRepository
    await this.keyPairRepository.save(keyPairRecord)
    return Key.fromPublicKey(blsKeyPair.publicKey, keyType)
  }

  public static async sign({ data, key }: SignOptions): Promise<Buffer> {
    return Buffer.from([0])
  }

  public static async verify({ key, data, signature }: VerifyOptions): Promise<boolean> {}
}
