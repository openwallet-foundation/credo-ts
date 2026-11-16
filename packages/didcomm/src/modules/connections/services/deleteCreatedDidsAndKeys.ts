import { type AgentContext, DidRepository, Kms } from '@credo-ts/core'
import { DidCommRoutingService } from '../../routing/services/DidCommRoutingService'
import type { DidCommCreatedKey, DidCommCreatedKeys } from '../repository/DidCommConnectionMetadataTypes'

/**
 * Deletes the DIDs and keys Credo created for a connection or out-of-band record, with their mediator and tenant
 * routing. DIDs and keys that a related record (`keep`) also created are kept: an invitation passes its DID and keys
 * on to its connections.
 *
 * A DID whose keys failed to delete is kept, and the other DIDs and keys are still deleted. It then throws for the keys
 * that weren't deleted, and calling it again retries them.
 */
export async function deleteCreatedDidsAndKeys(
  agentContext: AgentContext,
  created: DidCommCreatedKeys,
  keep: Array<DidCommCreatedKeys | undefined | null>
) {
  const didRepository = agentContext.resolve(DidRepository)
  const routingService = agentContext.resolve(DidCommRoutingService)
  const keepDids = new Set(keep.flatMap((related) => related?.dids ?? []))
  const keepKmsKeyIds = new Set(keep.flatMap((related) => related?.keys.map(({ keyId }) => keyId) ?? []))
  const didKmsKeyIds = new Set<string>()
  const failedKeys: Kms.KeyManagementNotDeletedKey[] = []

  const deleteRouting = async (keys: DidCommCreatedKey[], did?: string) => {
    try {
      await routingService.deleteRouting(agentContext, { keys, did })
      return true
    } catch (error) {
      if (!(error instanceof Kms.KeyManagementKeysNotDeletedError)) throw error
      failedKeys.push(...error.keys)
      return false
    }
  }

  for (const did of created.dids) {
    if (keepDids.has(did)) continue
    const didRecord = await didRepository.findCreatedDid(agentContext, did)
    if (!didRecord) continue

    const keys = created.keys.filter(
      ({ keyId }) => didRecord.keys?.some(({ kmsKeyId }) => kmsKeyId === keyId) && !keepKmsKeyIds.has(keyId)
    )
    for (const { keyId } of keys) didKmsKeyIds.add(keyId)
    if (await deleteRouting(keys, did)) await didRepository.delete(agentContext, didRecord)
  }

  const keys = created.keys.filter(({ keyId }) => !keepKmsKeyIds.has(keyId) && !didKmsKeyIds.has(keyId))
  if (keys.length > 0) await deleteRouting(keys)

  if (failedKeys.length) throw new Kms.KeyManagementKeysNotDeletedError(failedKeys)
}
