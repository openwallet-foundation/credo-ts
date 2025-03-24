export function importSecureEnvironment(): {
  sign: (id: string, message: Uint8Array, biometricsBacked?: boolean) => Promise<Uint8Array>
  getPublicBytesForKeyId: (id: string) => Promise<Uint8Array>
  generateKeypair: (id: string, biometricsBacked?: boolean) => Promise<void>
} {
  throw new Error(
    '@animo-id/expo-secure-environment cannot be imported in Node.js. Currently, there is no hardware key support for node.js'
  )
}
