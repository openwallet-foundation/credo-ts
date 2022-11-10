import type { CreateKeyPairOptions, KeyPair, KeyProvider } from '../signing-provider/KeyProvider'

import * as ed25519 from '@stablelib/ed25519'

import { injectable } from '../../plugins'
import { TypedArrayEncoder } from '../../utils'
import { Buffer } from '../../utils/buffer'
import { KeyType } from '../KeyType'

/**
 * This will be extracted to the x25519 package.
 */
@injectable()
export class X25519KeyProvider implements KeyProvider {
  public readonly keyType = KeyType.X25519

  /**
   * Create a KeyPair with type X25519
   *
   * @throws {KeyProviderError} When a key could not be created
   */
  public async createKeyPair({ seed }: CreateKeyPairOptions): Promise<KeyPair> {
    const keyPair = seed ? ed25519.generateKeyPairFromSeed(new Buffer(seed)) : ed25519.generateKeyPair()
    const privateKey = ed25519.convertSecretKeyToX25519(keyPair.secretKey)
    const publicKey = ed25519.convertPublicKeyToX25519(keyPair.publicKey)

    return {
      keyType: KeyType.X25519,
      publicKeyBase58: TypedArrayEncoder.toBase58(publicKey),
      privateKeyBase58: TypedArrayEncoder.toBase58(privateKey),
    }
  }

  public async sign(): Promise<Buffer> {
    throw new Error('Method not supported.')
  }

  public async verify(): Promise<boolean> {
    throw new Error('Method not supported.')
  }
}
