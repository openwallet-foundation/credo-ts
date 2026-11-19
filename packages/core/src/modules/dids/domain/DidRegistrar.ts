import type { AgentContext } from '../../../agent'
import { KeyManagementApi, type KmsKeyReference } from '../../kms'
import type { DidDocumentKey } from '../DidsApiOptions'
import type {
  DidCreateOptions,
  DidCreateResult,
  DidDeactivateOptions,
  DidDeactivateResult,
  DidUpdateOptions,
  DidUpdateResult,
} from '../types'

/**
 * Whether a did can be deactivated. `supported` publishes the deactivation, such as on a ledger. `notSupportedByMethod`
 * when the did method has no deactivation, such as did:key. `notSupportedByRegistrar` when the did method has one, but
 * the registrar doesn't implement it, such as did:indy.
 */
export type DidDeactivationSupport = 'supported' | 'notSupportedByMethod' | 'notSupportedByRegistrar'

export interface DidRegistrar {
  readonly supportedMethods: string[]

  readonly deactivationSupport: DidDeactivationSupport

  create(agentContext: AgentContext, options: DidCreateOptions): Promise<DidCreateResult>

  /**
   * Fails for a did whose created did record is deactivated.
   */
  update(agentContext: AgentContext, options: DidUpdateOptions): Promise<DidUpdateResult>

  /**
   * Sets the status of the created did record to deactivated. Not implemented when `deactivationSupport` is
   * `notSupportedByMethod`, as the did registrar service then only deactivates the did record.
   */
  deactivate?(agentContext: AgentContext, options: DidDeactivateOptions): Promise<DidDeactivateResult>
}

/**
 * Returns the keys that are in the previous keys but not in the remaining keys. A remaining key can be shared by another verification method.
 */
export function getRemovedDidKeys(previousKeys: DidDocumentKey[], remainingKeys: DidDocumentKey[] = []) {
  return previousKeys
    .filter(({ kmsKeyId }) => !remainingKeys.some((key) => key.kmsKeyId === kmsKeyId))
    .map(({ kmsKeyId, kmsBackend }): KmsKeyReference => ({ keyId: kmsKeyId, kmsBackend }))
}

/**
 * Deletes keys of a did whose ledger change is already done. A failed delete is logged, not thrown, so the other keys are still deleted.
 */
export async function deleteDidKeys(agentContext: AgentContext, keys: KmsKeyReference[], reason: string) {
  const kms = agentContext.dependencyManager.resolve(KeyManagementApi)
  for (const { keyId, kmsBackend } of keys) {
    await kms.deleteKey({ keyId, backend: kmsBackend }).catch((deleteError) => {
      agentContext.config.logger.error(`Failed to delete key ${keyId} ${reason}`, { deleteError })
    })
  }
}
