import { hash as sha256 } from '@stablelib/sha256'

export type HashName = 'sha2-256'

type HashingMap = {
  [key in HashName]: (data: Uint8Array) => Uint8Array
}

const hashingMap: HashingMap = {
  'sha2-256': (data) => sha256(data),
}

export class Hasher {
  public static hash(data: Uint8Array, hashName: HashName): Uint8Array {
    const hashFn = hashingMap[hashName]

    if (!hashFn) {
      throw new Error(`Unsupported hash name '${hashName}'`)
    }

    return hashFn(data)
  }
}
