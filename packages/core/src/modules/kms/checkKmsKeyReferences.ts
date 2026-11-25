import type { AgentContext } from '../../agent'
import { KeyManagementError } from './error/KeyManagementError'

export interface CheckKmsKeyReferencesOptions {
  /** @default 'warn' */
  missingKeyId?: 'throw' | 'warn'

  /** @default 'warn' */
  missingBackend?: 'throw' | 'warn'
}

/**
 * Throws or warns once for a batch of keys stored without their key id or backend. Without a backend, each key
 * operation looks the key up in every backend, and without a key id, by its legacy key id.
 */
export function checkKmsKeyReferences(
  agentContext: AgentContext,
  keys: Array<{ keyId: string | undefined; backend: string | undefined }>,
  { missingKeyId = 'warn', missingBackend = 'warn' }: CheckKmsKeyReferencesOptions = {}
) {
  const missing = keys.filter(({ keyId, backend }) => !keyId || !backend)
  if (missing.length === 0) return

  const description = missing
    .map(({ keyId, backend }) =>
      keyId
        ? `'${keyId}' without backend`
        : backend
          ? `key without key id in backend '${backend}'`
          : 'key without key id or backend'
    )
    .join(', ')
  const hint = "Create the key with 'PublicJwk.fromKmsKey' or pass the key id and backend."

  if (
    missing.some(
      ({ keyId, backend }) => (!keyId && missingKeyId === 'throw') || (!backend && missingBackend === 'throw')
    )
  ) {
    throw new KeyManagementError(`Unable to store KMS keys without their key id or backend (${description}). ${hint}`)
  }

  agentContext.config.logger.warn(
    `Storing KMS keys without their key id or backend (${description}), so key operations look the key up in each backend or by its legacy key id. ${hint}`
  )
}
