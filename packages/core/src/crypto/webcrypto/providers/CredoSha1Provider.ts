import type { HashAlgorithm } from '../types'

import * as core from 'webcrypto-core'

import { Sha1 } from '../../hashes'

export class CredoSha1Provider extends core.ProviderCrypto {
  public name = 'SHA-1'
  public usages = []

  public override async onDigest(algorithm: HashAlgorithm, data: ArrayBuffer): Promise<ArrayBuffer> {
    switch (algorithm.name.toUpperCase()) {
      case 'SHA-1': {
        const hash = new Sha1().hash(new Uint8Array(data))
        return hash.buffer
      }
      default:
        throw new Error(`Hashing algorithm: ${JSON.stringify(algorithm)} is not supported`)
    }
  }
}
