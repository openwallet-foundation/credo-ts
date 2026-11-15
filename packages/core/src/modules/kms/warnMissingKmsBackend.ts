import type { AgentContext } from '../../agent'

/**
 * Warns once for a batch of keys stored without their key id or backend. Without a backend, each key operation looks
 * the key up in every backend, and without a key id, by its legacy key id.
 */
export function warnMissingKmsBackend(
  agentContext: AgentContext,
  keys: Array<{ keyId: string | undefined; backend: string | undefined }>
) {
  const missing = keys
    .filter(({ keyId, backend }) => !keyId || !backend)
    .map(({ keyId, backend }) =>
      keyId
        ? `'${keyId}' without backend`
        : backend
          ? `key without key id in backend '${backend}'`
          : 'key without key id or backend'
    )
  if (missing.length === 0) return

  agentContext.config.logger.warn(
    `Storing KMS keys without their key id or backend (${missing.join(', ')}), so key operations look the key up in each backend or by its legacy key id. Create the key with 'PublicJwk.fromKmsKey' or pass the key id and backend.`
  )
}
