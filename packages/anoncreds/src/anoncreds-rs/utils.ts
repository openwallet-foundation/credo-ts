import type { AgentContext, JsonObject, W3cJsonLdVerifiableCredential } from '@credo-ts/core'
import { CredoError, JsonTransformer } from '@credo-ts/core'
import type {
  JsonObject as AnonCredsJsonObject,
  NonRevokedIntervalOverride,
  ObjectHandle,
} from '@hyperledger/anoncreds-shared'
import {
  W3cCredential as AnonCredsW3cCredential,
  CredentialRevocationState,
  NativeAnoncreds,
  RevocationRegistryDefinition,
  RevocationStatusList,
} from '@hyperledger/anoncreds-shared'
import { AnonCredsModuleConfig } from '../AnonCredsModuleConfig'
import type { AnonCredsNonRevokedInterval } from '../models'
import {
  assertBestPracticeRevocationInterval,
  fetchRevocationRegistryDefinition,
  fetchRevocationStatusList,
} from '../utils'

export interface CredentialRevocationMetadata {
  timestamp?: number
  revocationRegistryId: string
  revocationRegistryIndex?: number
  nonRevokedInterval: AnonCredsNonRevokedInterval
}

export async function getRevocationMetadata(
  agentContext: AgentContext,
  credentialRevocationMetadata: CredentialRevocationMetadata,
  mustHaveTimeStamp = false
) {
  let nonRevokedIntervalOverride: NonRevokedIntervalOverride | undefined

  const { revocationRegistryId, revocationRegistryIndex, nonRevokedInterval, timestamp } = credentialRevocationMetadata
  if (!revocationRegistryId || !nonRevokedInterval || (mustHaveTimeStamp && !timestamp)) {
    throw new CredoError('Invalid revocation metadata')
  }

  // Make sure the revocation interval follows best practices from Aries RFC 0441
  assertBestPracticeRevocationInterval(nonRevokedInterval)

  const { revocationRegistryDefinition: anonCredsRevocationRegistryDefinition } =
    await fetchRevocationRegistryDefinition(agentContext, revocationRegistryId)

  const tailsFileService = agentContext.dependencyManager.resolve(AnonCredsModuleConfig).tailsFileService
  const { tailsFilePath } = await tailsFileService.getTailsFile(agentContext, {
    revocationRegistryDefinition: anonCredsRevocationRegistryDefinition,
  })

  const timestampToFetch = timestamp ?? nonRevokedInterval.to
  if (!timestampToFetch) throw new CredoError('Timestamp to fetch is required')

  const { revocationStatusList: _revocationStatusList } = await fetchRevocationStatusList(
    agentContext,
    revocationRegistryId,
    timestampToFetch
  )
  const updatedTimestamp = timestamp ?? _revocationStatusList.timestamp

  const revocationRegistryDefinition = anonCredsRevocationRegistryDefinition as unknown as JsonObject
  const revocationStatusList = _revocationStatusList as unknown as JsonObject
  const revocationState = revocationRegistryIndex
    ? createRevocationState({
        revocationRegistryIndex: Number(revocationRegistryIndex),
        revocationRegistryDefinition,
        tailsPath: tailsFilePath,
        revocationStatusList,
      })
    : undefined

  const requestedFrom = nonRevokedInterval.from
  if (requestedFrom && requestedFrom > timestampToFetch) {
    const { revocationStatusList: overrideRevocationStatusList } = await fetchRevocationStatusList(
      agentContext,
      revocationRegistryId,
      requestedFrom
    )

    const vdrTimestamp = overrideRevocationStatusList?.timestamp
    if (vdrTimestamp && vdrTimestamp === timestampToFetch) {
      nonRevokedIntervalOverride = {
        overrideRevocationStatusListTimestamp: timestampToFetch,
        requestedFromTimestamp: requestedFrom,
        revocationRegistryDefinitionId: revocationRegistryId,
      }
    } else {
      throw new CredoError(
        `VDR timestamp for ${requestedFrom} does not correspond to the one provided in proof identifiers. Expected: ${updatedTimestamp} and received ${vdrTimestamp}`
      )
    }
  }

  return {
    updatedTimestamp,
    revocationRegistryId,
    revocationRegistryDefinition,
    revocationStatusList,
    nonRevokedIntervalOverride,
    revocationState,
  }
}

/**
 * Creates the revocation state of a credential as JSON, and frees the native objects it needs for that
 */
export function createRevocationState(options: {
  revocationRegistryIndex: number
  revocationRegistryDefinition: AnonCredsJsonObject
  revocationStatusList: AnonCredsJsonObject
  tailsPath: string
}) {
  let revocationRegistryDefinition: RevocationRegistryDefinition | undefined
  let revocationStatusList: RevocationStatusList | undefined
  let revocationState: CredentialRevocationState | undefined
  try {
    revocationRegistryDefinition = RevocationRegistryDefinition.fromJson(options.revocationRegistryDefinition)
    revocationStatusList = RevocationStatusList.fromJson(options.revocationStatusList)
    revocationState = CredentialRevocationState.create({
      revocationRegistryIndex: options.revocationRegistryIndex,
      revocationRegistryDefinition,
      tailsPath: options.tailsPath,
      revocationStatusList,
    })

    return revocationState.toJson()
  } finally {
    revocationState?.handle.clear()
    revocationStatusList?.handle.clear()
    revocationRegistryDefinition?.handle.clear()
  }
}

/**
 * Reads the metadata of a W3C AnonCreds credential, and frees the native credential it needs for that
 */
export function getW3cAnonCredsCredentialProofDetails(credentialJson: JsonObject) {
  let credential: AnonCredsW3cCredential | undefined
  let proofDetails: ObjectHandle | undefined
  try {
    credential = AnonCredsW3cCredential.fromJson(credentialJson)
    // The getters of anoncreds-shared 0.4 cache the proof details and never free them, so we read them ourselves
    proofDetails = NativeAnoncreds.instance.w3cCredentialGetIntegrityProofDetails({ objectHandle: credential.handle })

    const objectHandle = proofDetails
    const getAttribute = (name: string) =>
      NativeAnoncreds.instance.w3cCredentialProofGetAttribute({ objectHandle, name }) ?? undefined
    const revocationRegistryIndex = getAttribute('rev_reg_index')
    const timestamp = getAttribute('timestamp')

    return {
      schemaId: getAttribute('schema_id'),
      credentialDefinitionId: getAttribute('cred_def_id'),
      revocationRegistryId: getAttribute('rev_reg_id'),
      revocationRegistryIndex: revocationRegistryIndex ? Number(revocationRegistryIndex) : undefined,
      timestamp: timestamp ? Number(timestamp) : undefined,
    }
  } finally {
    proofDetails?.clear()
    credential?.handle.clear()
  }
}

export const getW3cAnonCredsCredentialMetadata = (w3cJsonLdVerifiableCredential: W3cJsonLdVerifiableCredential) => {
  const w3cJsonLdVerifiableCredentialJson = JsonTransformer.toJSON(w3cJsonLdVerifiableCredential)

  const { schemaId, credentialDefinitionId, revocationRegistryId } = getW3cAnonCredsCredentialProofDetails(
    w3cJsonLdVerifiableCredentialJson
  )

  if (!schemaId) throw new CredoError('Missing schemaId in W3C AnonCreds credential')
  if (!credentialDefinitionId) throw new CredoError('Missing credentialDefinitionId in W3C AnonCreds credential')

  return {
    schemaId,
    credentialDefinitionId,
    revocationRegistryId: revocationRegistryId ?? undefined,
  }
}
