import type { AgentContext } from '../agent'
import { CredoError, RecordNotFoundError } from '../error'
import { DidsApi } from '../modules/dids/DidsApi'
import { DidRegistrarService } from '../modules/dids/services/DidRegistrarService'
import {
  deleteKmsKeys,
  KeyManagementKeysNotDeletedError,
  type KeyManagementNotDeletedKey,
  type KmsKeyReference,
} from '../modules/kms'
import type { BaseRecordAny } from '../storage/BaseRecord'

const holderBindingDidsMetadataKey = '_internal/holderBindingDids'

/**
 * The DIDs that were created only to bind this credential, so deleting its holder binding also deletes them.
 */
export function getCredentialHolderBindingDids(record: BaseRecordAny): string[] {
  return record.metadata.get<{ dids: string[] }>(holderBindingDidsMetadataKey)?.dids ?? []
}

/**
 * Throws for a DID that can't be deleted with the credential record. Only a DID whose method has no deactivation, such
 * as did:key, can, because deleting the record doesn't deactivate it.
 */
export function assertDidDeletableWithRecord(agentContext: AgentContext, did: string) {
  const deactivationSupport = agentContext.dependencyManager.resolve(DidRegistrarService).getDeactivationSupport(did)
  if (deactivationSupport !== 'notSupportedByMethod') {
    throw new CredoError(
      `Did '${did}' can't be deleted with the credential record, because its did method has deactivation. Only dids whose method has no deactivation, such as did:key, can.`
    )
  }
}

/**
 * Marks DIDs as created only to bind this credential.
 */
export function addCredentialHolderBindingDids(record: BaseRecordAny, dids: string[]) {
  if (dids.length === 0) return
  const allDids = new Set([...getCredentialHolderBindingDids(record), ...dids])
  record.metadata.set(holderBindingDidsMetadataKey, { dids: [...allDids] })
}

/**
 * Deletes the holder binding keys of a credential, and the DIDs created to bind it together with their keys. It
 * doesn't delete the record itself, and doesn't check whether another record still uses a key.
 *
 * A key that fails to delete doesn't stop the others. A DID whose keys failed to delete is kept. It then throws for the
 * keys that weren't deleted, and calling it again retries them.
 */
export async function deleteHolderBinding(
  agentContext: AgentContext,
  dids: string[],
  holderKeys: KmsKeyReference[] = []
) {
  const didsApi = agentContext.dependencyManager.resolve(DidsApi)
  const failedKeys: KeyManagementNotDeletedKey[] = []
  const collectFailedKeys = (error: unknown) => {
    // Deleted by an earlier call that failed afterwards
    if (error instanceof RecordNotFoundError) return
    if (!(error instanceof KeyManagementKeysNotDeletedError)) throw error
    failedKeys.push(...error.keys)
  }

  // Credentials bound directly to a key (not a DID) first
  await deleteKmsKeys(agentContext, holderKeys).catch(collectFailedKeys)
  for (const did of dids) {
    await didsApi.deleteCreatedDid({ did, deleteAssociatedKeys: true }).catch(collectFailedKeys)
  }

  if (failedKeys.length) throw new KeyManagementKeysNotDeletedError(failedKeys)
}
