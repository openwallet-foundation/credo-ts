import { KeyManagementError } from './KeyManagementError'

export class KeyManagementKeyNotFoundError extends KeyManagementError {
  public constructor(keyId: string, backends: string[], extraMessage?: string) {
    const base = `Key with key id '${keyId}' not found in backend`

    const withBackends =
      backends.length > 1 ? `${base}s ${backends.map((b) => `'${b}'`).join(', ')}` : `${base} '${backends[0]}'`

    const withExtraMessage = extraMessage ? `${withBackends}. ${extraMessage}` : withBackends

    super(withExtraMessage)
  }
}
