import { type AgentContext, deleteHolderBinding } from '@credo-ts/core'
import type { DidCommCredentialExchangeRecord } from '../repository/DidCommCredentialExchangeRecord'

const holderBindingDidsMetadataKey = '_internal/holderBindingDids'

// Per format key, as one exchange can issue a credential for each of several formats
type HolderBindingDids = Record<string, string[]>

function getHolderBindingDids(credentialExchangeRecord: DidCommCredentialExchangeRecord): HolderBindingDids {
  return credentialExchangeRecord.metadata.get<HolderBindingDids>(holderBindingDidsMetadataKey) ?? {}
}

/**
 * Marks DIDs as created only to bind the credential of this format, until the credential record takes them over.
 */
export function addExchangeHolderBindingDids(
  credentialExchangeRecord: DidCommCredentialExchangeRecord,
  formatKey: string,
  dids: string[]
) {
  if (dids.length === 0) return
  const holderBindingDids = getHolderBindingDids(credentialExchangeRecord)
  holderBindingDids[formatKey] = [...new Set([...(holderBindingDids[formatKey] ?? []), ...dids])]
  credentialExchangeRecord.metadata.set(holderBindingDidsMetadataKey, holderBindingDids)
}

/**
 * Removes the binding DIDs of this format from the exchange and returns them, for the credential record to own.
 */
export function takeExchangeHolderBindingDids(
  credentialExchangeRecord: DidCommCredentialExchangeRecord,
  formatKey: string
): string[] {
  const { [formatKey]: dids, ...otherFormats } = getHolderBindingDids(credentialExchangeRecord)
  if (!dids) return []

  if (Object.keys(otherFormats).length > 0) {
    credentialExchangeRecord.metadata.set(holderBindingDidsMetadataKey, otherFormats)
  } else {
    credentialExchangeRecord.metadata.delete(holderBindingDidsMetadataKey)
  }
  return dids
}

/**
 * Deletes the binding DIDs, and their keys, of the formats whose credential record didn't take them over.
 */
export async function deleteExchangeHolderBinding(
  agentContext: AgentContext,
  credentialExchangeRecord: DidCommCredentialExchangeRecord
) {
  const dids = Object.values(getHolderBindingDids(credentialExchangeRecord)).flat()
  if (dids.length > 0) await deleteHolderBinding(agentContext, dids)
}
