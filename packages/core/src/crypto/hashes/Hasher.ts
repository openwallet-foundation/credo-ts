import { CredoError } from '../../error'
import type { AnyUint8Array, Uint8ArrayBuffer } from '../../types'
import { TypedArrayEncoder } from '../../utils'

import { Sha1 } from './Sha1'
import { Sha256 } from './Sha256'
import { Sha384 } from './Sha384'
import { Sha512 } from './Sha512'

export type HashName = 'sha-512' | 'sha-384' | 'sha-256' | 'sha-1'

// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
export class Hasher {
  public static hash(data: AnyUint8Array | string, hashName: HashName | ({} & string)): Uint8ArrayBuffer {
    const dataInput = typeof data === 'string' ? TypedArrayEncoder.fromString(data) : data
    switch (hashName.toUpperCase()) {
      case 'SHA-512':
        return new Sha512().hash(dataInput)
      case 'SHA-384':
        return new Sha384().hash(dataInput)
      case 'SHA-256':
        return new Sha256().hash(dataInput)
      case 'SHA-1':
        return new Sha1().hash(dataInput)
      default:
        throw new CredoError(`Hash name: '${hashName}' is not supported.`)
    }
  }
}
