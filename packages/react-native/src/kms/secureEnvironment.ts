export function importSecureEnvironment(): {
  sign: (id: string, message: Uint8Array) => Promise<Uint8Array>
  getPublicBytesForKeyId: (id: string) => Promise<Uint8Array>
  generateKeypair: (id: string) => Promise<void>
  deleteKey: (id: string) => Promise<void>
  KeyAlreadyExistsError: typeof Error
  KeyNotFoundError: typeof Error
} {
  try {
    const secureEnvironment = require('@animo-id/expo-secure-environment')
    return secureEnvironment
  } catch (_error) {
    throw new Error('@animo-id/expo-secure-environment must be installed as a peer dependency')
  }
}
