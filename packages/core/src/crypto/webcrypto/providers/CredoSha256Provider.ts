import * as core from 'webcrypto-core'
import { Sha256 } from '../../hashes'
import type { HashAlgorithm } from '../types'

export class CredoSha256Provider extends core.ProviderCrypto {
  public name = 'SHA-256'
  public usages = []

  public override async onDigest(algorithm: HashAlgorithm, data: ArrayBuffer): Promise<ArrayBuffer> {
    switch (algorithm.name.toUpperCase()) {
      case 'SHA-256': {
        const hash = new Sha256().hash(new Uint8Array(data))
        return hash.buffer
      }
      default:
        throw new Error(`Hashing algorithm: ${JSON.stringify(algorithm)} is not supported`)
    }
  }
}
