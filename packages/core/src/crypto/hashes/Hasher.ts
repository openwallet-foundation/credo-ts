import { CredoError } from '../../error'
import { TypedArrayEncoder } from '../../utils/TypedArrayEncoder'

import type { IHash } from './IHash'
import { Sha1 } from './Sha1'
import { Sha256 } from './Sha256'
import { Sha384 } from './Sha384'
import { Sha512 } from './Sha512'

export type HashName = 'sha-512' | 'sha-384' | 'sha-256' | 'sha-1'

/**
 * Must return a `Uint8Array` that owns its whole `ArrayBuffer`, as callers use `.buffer`.
 */
export type HashImplementation = (data: Uint8Array, hashName: HashName) => Uint8Array

const jsHashes: Record<HashName, IHash> = {
  'sha-512': new Sha512(),
  'sha-384': new Sha384(),
  'sha-256': new Sha256(),
  'sha-1': new Sha1(),
}

// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
export class Hasher {
  private static implementation?: HashImplementation

  /**
   * Replaces the JavaScript hash implementation for every agent in the process, e.g. with native hashing.
   * `@credo-ts/node` sets this when imported. Pass `undefined` to go back to the JavaScript implementation.
   */
  public static setImplementation(implementation: HashImplementation | undefined) {
    Hasher.implementation = implementation
  }

  // Uses `Hasher` instead of `this`, as `Hasher.hash` is passed around as a callback
  public static hash(data: Uint8Array | string, hashName: HashName | ({} & string)): Uint8Array {
    const dataInput = typeof data === 'string' ? TypedArrayEncoder.fromUtf8String(data) : data
    const name = hashName.toLowerCase()
    if (!Object.hasOwn(jsHashes, name)) throw new CredoError(`Hash name: '${hashName}' is not supported.`)

    return Hasher.implementation
      ? Hasher.implementation(dataInput, name as HashName)
      : jsHashes[name as HashName].hash(dataInput)
  }
}
