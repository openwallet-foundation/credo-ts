import type { AgentContext } from '../../agent'
import { KeyManagementKeysNotDeletedError } from './error/KeyManagementKeysNotDeletedError'
import { KeyManagementApi } from './KeyManagementApi'
import type { KmsKeyReference } from './options'

/**
 * Deletes every key, so one failed delete doesn't leave the rest, then throws for the keys that failed. A key that is
 * already gone counts as deleted, so a failed call can be retried.
 */
export async function deleteKmsKeys(agentContext: AgentContext, keys: KmsKeyReference[]) {
  const kms = agentContext.resolve(KeyManagementApi)
  const results = await Promise.allSettled(
    keys.map(({ keyId, kmsBackend }) => kms.deleteKey({ keyId, backend: kmsBackend }))
  )

  const failedKeys = keys.flatMap(({ keyId, kmsBackend }, index) => {
    const result = results[index]
    return result.status === 'rejected' ? [{ keyId, kmsBackend, cause: result.reason as Error }] : []
  })
  if (failedKeys.length) throw new KeyManagementKeysNotDeletedError(failedKeys)
}
