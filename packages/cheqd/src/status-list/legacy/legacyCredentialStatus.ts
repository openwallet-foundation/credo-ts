import type { AgentContext } from '@credo-ts/core'
import { CredoError, JsonTransformer, W3cJwtVerifiableCredential } from '@credo-ts/core'

import {
  checkLegacyCredentialStatus,
  defaultBitstringStatusMessages,
  expandLegacyStatusIndices,
  type LegacyStatusEntry,
  type LegacyStatusMessage,
  type LegacyStatusResult,
  parseLegacyStatusListUri,
  updateLegacyStatusList,
} from './legacyStatusList'

/** A credential as the status of its lists is read from: the object, or the compact JWT of a JWT credential */
export type LegacyStatusCredential =
  | string
  | { issuer: string | { id: string }; credentialStatus?: LegacyStatusEntry | LegacyStatusEntry[] }

function asStatusInput(credential: LegacyStatusCredential) {
  if (typeof credential !== 'string') return credential
  const decoded = W3cJwtVerifiableCredential.fromSerializedJwt(credential)
  return JsonTransformer.toJSON(decoded.credential) as Exclude<LegacyStatusCredential, string>
}

export type LegacyStatusAction = 'revoke' | 'suspend' | 'reinstate'

function messageValue(messages: LegacyStatusMessage[] | undefined, message: string, fallback: number) {
  const found = (messages ?? defaultBitstringStatusMessages).find((candidate) => candidate.message === message)
  return found ? Number.parseInt(found.status, 16) : fallback
}

/**
 * Revokes, suspends or reinstates a credential by writing the entries of its `credentialStatus` to their lists, each as a
 * new version of the list. The lists must belong to the issuer of the credential, and the issuer must be a DID this agent
 * controls.
 *
 * - StatusList2021: `revoke` needs a revocation entry and sets it, `suspend` needs a suspension entry and sets it,
 *   `reinstate` clears a suspension entry. A revocation is not undone.
 * - Bitstring: revoke is the value of the message `revoked` (1), suspend of `suspended` (2), reinstate is 0.
 *
 * An entry may name its list by resource id. The change is still written to the latest version of that list, but the
 * entry keeps pointing at the old, immutable version (`pinned`).
 */
export async function setLegacyCredentialStatus(
  agentContext: AgentContext,
  credential: LegacyStatusCredential,
  action: LegacyStatusAction,
  options: { maxIndices?: number } = {}
) {
  const { issuer, credentialStatus } = asStatusInput(credential)
  const issuerDid = typeof issuer === 'string' ? issuer : issuer.id
  const entries = Array.isArray(credentialStatus) ? credentialStatus : credentialStatus ? [credentialStatus] : []
  if (entries.length === 0) throw new CredoError('The credential has no credentialStatus')

  const written: {
    did: string
    name: string
    resourceType: string
    resourceId: string
    indices: number[]
    value: number
    /** The entry names one version of the list, so it still reads the old version and the credential will not read as changed */
    pinned: boolean
  }[] = []

  for (const entry of entries) {
    const list = parseLegacyStatusListUri(entry.statusListCredential)
    if (!list) throw new CredoError(`'${entry.statusListCredential}' is not the uri of a did:cheqd status list`)
    if (list.did !== issuerDid) {
      throw new CredoError(`The status list is a resource of ${list.did}, not of the issuer ${issuerDid}`)
    }

    let value: number
    if (entry.type === 'StatusList2021Entry') {
      if (action === 'revoke' && entry.statusPurpose === 'revocation') value = 1
      else if (action === 'suspend' && entry.statusPurpose === 'suspension') value = 1
      else if (action === 'reinstate' && entry.statusPurpose === 'suspension') value = 0
      else if (action === 'reinstate') throw new CredoError('A revocation cannot be undone')
      else throw new CredoError(`Cannot ${action} an entry of the purpose '${entry.statusPurpose}'`)
    } else if (entry.type === 'BitstringStatusListEntry') {
      value =
        action === 'revoke'
          ? messageValue(entry.statusMessage, 'revoked', 1)
          : action === 'suspend'
            ? messageValue(entry.statusMessage, 'suspended', 2)
            : 0
    } else {
      throw new CredoError(`Unsupported credential status type '${(entry as { type: string }).type}'`)
    }

    const indices = expandLegacyStatusIndices(entry, options.maxIndices)
    const updates = indices.map((index) => ({ index, value }))
    const pinned = 'resourceId' in list
    const updated = await updateLegacyStatusList(
      agentContext,
      list.did,
      pinned ? { resourceId: list.resourceId, updates } : { name: list.name, resourceType: list.resourceType, updates }
    )
    written.push({ did: list.did, ...updated, indices, value, pinned })
  }

  return written
}

export interface LegacyPresentationStatus {
  /** Every credential has a status that is valid */
  valid: boolean
  /** At least one credential is revoked */
  revoked: boolean
  /** At least one credential is suspended */
  suspended: boolean
  credentials: ({ index: number; results: LegacyStatusResult[] } | { index: number; error: string })[]
}

/**
 * Reads the status of every credential of a presentation. A credential without a `credentialStatus` has nothing to
 * check. A credential whose status cannot be read (a list that is missing, that is not the issuer's, or that is
 * encrypted) is reported with its error and makes the presentation not valid, so it does not hide the others.
 *
 * Verifying the presentation and its credentials is separate: this only reads status.
 */
export async function checkLegacyPresentationStatus(
  agentContext: AgentContext,
  presentation: { verifiableCredential?: LegacyStatusCredential | LegacyStatusCredential[] },
  options: { maxIndices?: number } = {}
): Promise<LegacyPresentationStatus> {
  const credentials = Array.isArray(presentation.verifiableCredential)
    ? presentation.verifiableCredential
    : presentation.verifiableCredential
      ? [presentation.verifiableCredential]
      : []
  if (credentials.length === 0) throw new CredoError('The presentation has no credentials')

  const status: LegacyPresentationStatus = { valid: true, revoked: false, suspended: false, credentials: [] }
  for (const [index, credential] of credentials.entries()) {
    try {
      const results = await checkLegacyCredentialStatus(agentContext, asStatusInput(credential), options)
      status.credentials.push({ index, results })
      for (const result of results) {
        if (!result.valid) status.valid = false
        if (result.revoked) status.revoked = true
        if (result.suspended) status.suspended = true
      }
    } catch (error) {
      status.valid = false
      status.credentials.push({ index, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return status
}
