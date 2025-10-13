import { KeyManagementError } from './KeyManagementError'

export class KeyManagementKeyNotFoundError extends KeyManagementError {
  public constructor(keyId: string, backends: string | string[], extraMessage?: string) {
    const base = `Key with key id '${keyId}' not found in backend`
    const backendsArray = typeof backends === 'string' ? [backends] : backends
    const full =
      backendsArray.length >= 1
        ? `${base}s ${backendsArray.map((b) => `'${b}'`).join(', ')}`
        : `${base} '${backendsArray[0]}'`
    const withExtraMessage = extraMessage ? `${full}. ${extraMessage}` : full
    super(withExtraMessage)
  }
}
