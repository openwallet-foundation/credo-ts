import * as core from 'webcrypto-core'
import { Hasher } from '../../hashes'
import type { HashAlgorithm } from '../types'

export class CredoSha256Provider extends core.ProviderCrypto {
  public name = 'SHA-256'
  public usages = []

  public override async onDigest(algorithm: HashAlgorithm, data: ArrayBuffer): Promise<ArrayBuffer> {
    switch (algorithm.name.toUpperCase()) {
      case 'SHA-256': {
        const hash = Hasher.hash(new Uint8Array(data), 'sha-256')
        return hash.buffer as ArrayBuffer
      }
      default:
        throw new Error(`Hashing algorithm: ${JSON.stringify(algorithm)} is not supported`)
    }
  }
}
