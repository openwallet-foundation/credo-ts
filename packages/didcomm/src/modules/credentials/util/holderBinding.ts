import { type AgentContext, deleteHolderBinding, type Kms } from '@credo-ts/core'
import type { DidCommCredentialExchangeRecord } from '../repository/DidCommCredentialExchangeRecord'

const exchangeHolderBindingDidsMetadataKey = '_internal/exchangeHolderBindingDids'
const exchangeHolderBindingKeysMetadataKey = '_internal/exchangeHolderBindingKeys'

// Per format key, as one exchange can issue a credential for each of several formats
type HolderBindingDids = Record<string, string[]>

function getHolderBindingDids(credentialExchangeRecord: DidCommCredentialExchangeRecord): HolderBindingDids {
  return credentialExchangeRecord.metadata.get<HolderBindingDids>(exchangeHolderBindingDidsMetadataKey) ?? {}
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
  credentialExchangeRecord.metadata.set(exchangeHolderBindingDidsMetadataKey, holderBindingDids)
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
    credentialExchangeRecord.metadata.set(exchangeHolderBindingDidsMetadataKey, otherFormats)
  } else {
    credentialExchangeRecord.metadata.delete(exchangeHolderBindingDidsMetadataKey)
  }
  return dids
}

// Per format key, like the DIDs
type HolderBindingKeys = Record<string, Kms.KmsKeyReference[]>

function getHolderBindingKeys(credentialExchangeRecord: DidCommCredentialExchangeRecord): HolderBindingKeys {
  return credentialExchangeRecord.metadata.get<HolderBindingKeys>(exchangeHolderBindingKeysMetadataKey) ?? {}
}

/**
 * Marks keys as created only to bind the credential of this format, until the credential record takes them over.
 */
export function addExchangeHolderBindingKeys(
  credentialExchangeRecord: DidCommCredentialExchangeRecord,
  formatKey: string,
  keys: Kms.KmsKeyReference[]
) {
  if (keys.length === 0) return
  const holderBindingKeys = getHolderBindingKeys(credentialExchangeRecord)
  holderBindingKeys[formatKey] = [
    ...(holderBindingKeys[formatKey] ?? []),
    ...keys.map(({ keyId, kmsBackend }) => ({ keyId, kmsBackend })),
  ]
  credentialExchangeRecord.metadata.set(exchangeHolderBindingKeysMetadataKey, holderBindingKeys)
}

/**
 * Removes the binding keys of this format from the exchange and returns them, for the credential record to own.
 */
export function takeExchangeHolderBindingKeys(
  credentialExchangeRecord: DidCommCredentialExchangeRecord,
  formatKey: string
): Kms.KmsKeyReference[] {
  const { [formatKey]: keys, ...otherFormats } = getHolderBindingKeys(credentialExchangeRecord)
  if (!keys) return []

  if (Object.keys(otherFormats).length > 0) {
    credentialExchangeRecord.metadata.set(exchangeHolderBindingKeysMetadataKey, otherFormats)
  } else {
    credentialExchangeRecord.metadata.delete(exchangeHolderBindingKeysMetadataKey)
  }
  return keys
}

/**
 * Deletes the binding DIDs and keys, and the keys of the DIDs, of the formats whose credential record didn't take
 * them over.
 */
export async function deleteExchangeHolderBinding(
  agentContext: AgentContext,
  credentialExchangeRecord: DidCommCredentialExchangeRecord
) {
  const dids = Object.values(getHolderBindingDids(credentialExchangeRecord)).flat()
  const keys = Object.values(getHolderBindingKeys(credentialExchangeRecord)).flat()
  if (dids.length > 0 || keys.length > 0) await deleteHolderBinding(agentContext, dids, keys)
}
