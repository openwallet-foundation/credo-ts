import { Hasher } from '@credo-ts/core'

// jsonld and rdf-canonize hash with crypto.subtle.digest, which React Native doesn't provide.
if (typeof globalThis.crypto.subtle?.digest !== 'function') {
  Object.assign(globalThis.crypto, {
    subtle: {
      ...globalThis.crypto.subtle,
      digest: async (algorithm: string | { name: string }, data: ArrayBuffer | ArrayBufferView) => {
        const bytes = ArrayBuffer.isView(data)
          ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
          : new Uint8Array(data)
        return Hasher.hash(bytes, typeof algorithm === 'string' ? algorithm : algorithm.name).slice().buffer
      },
    },
  })
}
