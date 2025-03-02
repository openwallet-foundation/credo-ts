import { CredoError } from '../../error'

import { Sha1 } from './Sha1'
import { Sha256 } from './Sha256'

export type HashName = 'sha-256' | 'sha-1'

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class Hasher {
  public static hash(data: Uint8Array | string, hashName: HashName | string) {
    switch (hashName.toUpperCase()) {
      case 'SHA-256':
        return new Sha256().hash(data)
      case 'SHA-1':
        return new Sha1().hash(data)
      default:
        throw new CredoError(`Hash name: '${hashName}' is not supported.`)
    }
  }
}
