import { createHash } from 'node:crypto'
import type { HashImplementation } from '@credo-ts/core'

// Copied out of the Buffer, as a Buffer may share its ArrayBuffer and `Buffer.slice` doesn't copy
export const nodeHash: HashImplementation = (data, hashName) =>
  new Uint8Array(createHash(hashName).update(data).digest())
