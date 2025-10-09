export async function importSecureEnvironment() {
  try {
    const secureEnvironment = await import('@animo-id/expo-secure-environment')
    return secureEnvironment
  } catch (_error) {
    throw new Error('@animo-id/expo-secure-environment must be installed as a peer dependency')
  }
}
