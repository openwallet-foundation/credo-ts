import { type AgentContext, type DidRecord, DidRepository, Kms } from '@credo-ts/core'
import { DidCommOutOfBandRole } from '../../oob/domain/DidCommOutOfBandRole'
import { DidCommOutOfBandRepository } from '../../oob/repository/DidCommOutOfBandRepository'
import { DidCommRoutingService } from '../../routing/services/DidCommRoutingService'
import type { DidCommCreatedKey, DidCommCreatedKeys } from '../repository/DidCommConnectionMetadataTypes'
import { DidCommConnectionRepository } from '../repository/DidCommConnectionRepository'

/**
 * Deletes the DIDs and keys Credo created for a connection or out-of-band record, with their mediator and tenant
 * routing. DIDs and keys that a related record (`keep`) also created are kept: an invitation passes its DID and keys
 * on to its connections, and the last of them to be deleted deletes them.
 *
 * `ownRecordIds` are the record being deleted and its invitation. A DID that any other connection or invitation still
 * uses is kept with its keys. Leave it out for a DID that no record got yet, which skips that check.
 *
 * A DID whose keys failed to delete is kept, and the other DIDs and keys are still deleted. It then throws for the keys
 * that weren't deleted, and calling it again retries them.
 */
export async function deleteCreatedDidsAndKeys(
  agentContext: AgentContext,
  created: DidCommCreatedKeys,
  keep: Array<DidCommCreatedKeys | undefined | null>,
  ownRecordIds?: string[]
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

    const didKeys = created.keys.filter(({ keyId }) => didRecord.keys?.some(({ kmsKeyId }) => kmsKeyId === keyId))
    for (const { keyId } of didKeys) didKmsKeyIds.add(keyId)
    if (ownRecordIds && (await isDidUsedByOtherRecord(agentContext, didRecord, didKeys, ownRecordIds))) continue

    const keys = didKeys.filter(({ keyId }) => !keepKmsKeyIds.has(keyId))
    if (await deleteRouting(keys, did)) await didRepository.delete(agentContext, didRecord)
  }

  const keys = created.keys.filter(({ keyId }) => !keepKmsKeyIds.has(keyId) && !didKmsKeyIds.has(keyId))
  if (keys.length > 0) await deleteRouting(keys)

  if (failedKeys.length) throw new Kms.KeyManagementKeysNotDeletedError(failedKeys)
}

/**
 * Whether a connection or invitation other than `ownRecordIds` uses the DID, which it got as `ourDid`, `toDid` or
 * `invitationDid`, or uses one of its keys.
 */
async function isDidUsedByOtherRecord(
  agentContext: AgentContext,
  didRecord: DidRecord,
  didKeys: DidCommCreatedKey[],
  ownRecordIds: string[]
) {
  const dids = [didRecord.did, ...(didRecord.getTags().alternativeDids ?? [])]
  // A DID can have many connections. One row more than our own records is enough to find another record.
  const queryOptions = { limit: ownRecordIds.length + 1 }
  const isOtherRecord = ({ id }: { id: string }) => !ownRecordIds.includes(id)

  const connections = await agentContext
    .resolve(DidCommConnectionRepository)
    .findByQuery(agentContext, { $or: dids.flatMap((did) => [{ did }, { previousDids: [did] }]) }, queryOptions)
  if (connections.some(isOtherRecord)) return true

  // A v1 invitation has no tag for a DID in its services, so it's found by the keys of the DID
  const outOfBandRecords = await agentContext.resolve(DidCommOutOfBandRepository).findByQuery(
    agentContext,
    {
      role: DidCommOutOfBandRole.Sender,
      $or: [
        ...dids.map((recipientDid) => ({ recipientDid })),
        ...didKeys.map(({ publicJwk }) => ({
          recipientKeyFingerprints: [Kms.PublicJwk.fromPublicJwk(publicJwk).fingerprint],
        })),
      ],
    },
    queryOptions
  )
  return outOfBandRecords.some(isOtherRecord)
}
