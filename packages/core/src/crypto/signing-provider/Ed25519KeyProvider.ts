import type {
  CreateKeyPairOptions,
  KeyPair,
  KeyProvider,
  SignOptions,
  VerifyOptions,
} from '../signing-provider/KeyProvider'

import * as ed25519 from '@stablelib/ed25519'

import { injectable } from '../../plugins'
import { TypedArrayEncoder } from '../../utils'
import { Buffer } from '../../utils/buffer'
import { KeyType } from '../KeyType'

/**
 * This will be extracted to the ed25519 package.
 */
@injectable()
export class Ed25519KeyProvider implements KeyProvider {
  public readonly keyType = KeyType.Ed25519

  /**
   * Create a KeyPair with type ED25519
   *
   * @throws {KeyProviderError} When a key could not be created
   */
  public async createKeyPair({ seed }: CreateKeyPairOptions): Promise<KeyPair> {
    const keyPair = seed ? ed25519.generateKeyPairFromSeed(new Buffer(seed)) : ed25519.generateKeyPair()

    return {
      keyType: KeyType.Ed25519,
      publicKeyBase58: TypedArrayEncoder.toBase58(keyPair.publicKey),
      privateKeyBase58: TypedArrayEncoder.toBase58(keyPair.secretKey),
    }
  }

  public async sign({ data, privateKeyBase58 }: SignOptions): Promise<Buffer> {
    const secretKeyBytes = TypedArrayEncoder.fromBase58(privateKeyBase58)
    return Buffer.from(ed25519.sign(secretKeyBytes, data as Buffer))
  }

  public async verify({ data, publicKeyBase58, signature }: VerifyOptions): Promise<boolean> {
    const publicKeyBytes = TypedArrayEncoder.fromBase58(publicKeyBase58)
    const message = Uint8Array.from(data as Buffer)
    return ed25519.verify(publicKeyBytes, message, signature)
  }
}
