export function importSecureEnvironment(): {
  sign: (id: string, message: Uint8Array) => Promise<Uint8Array>
  getPublicBytesForKeyId: (id: string) => Uint8Array | Promise<Uint8Array>
  generateKeypair: (id: string) => void | Promise<Uint8Array>
} {
  throw new Error(
    '@animo-id/expo-secure-environment cannot be imported in Node.js. Currently, there is no hardware key support for node.js'
  )
}
