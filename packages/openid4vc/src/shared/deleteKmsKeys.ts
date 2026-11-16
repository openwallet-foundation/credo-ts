import { type AgentContext, CredoError, Kms } from '@credo-ts/core'

// shortcut: local copy of `Kms.deleteKmsKeys` from delete-session-keys, replace it once that is merged
/**
 * Deletes every key, so one failed delete doesn't leave the rest, then throws for the keys that failed.
 */
export async function deleteKmsKeys(agentContext: AgentContext, keys: Array<{ keyId: string; kmsBackend?: string }>) {
  const kms = agentContext.resolve(Kms.KeyManagementApi)
  const results = await Promise.allSettled(
    keys.map(({ keyId, kmsBackend }) => kms.deleteKey({ keyId, backend: kmsBackend }))
  )

  const failedKeyIds = keys.filter((_, index) => results[index].status === 'rejected').map(({ keyId }) => keyId)
  if (failedKeyIds.length) {
    throw new CredoError(`Failed to delete keys with ids '${failedKeyIds.join("', '")}'`, {
      cause: results.find((result) => result.status === 'rejected')?.reason,
    })
  }
}
