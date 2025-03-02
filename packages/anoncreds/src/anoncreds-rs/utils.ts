import type { AgentContext, JsonObject, W3cJsonLdVerifiableCredential } from '@credo-ts/core'
import type { NonRevokedIntervalOverride } from '@hyperledger/anoncreds-shared'
import type { AnonCredsNonRevokedInterval } from '../models'

import { CredoError, JsonTransformer } from '@credo-ts/core'
import {
  W3cCredential as AnonCredsW3cCredential,
  CredentialRevocationState,
  RevocationRegistryDefinition,
  RevocationStatusList,
} from '@hyperledger/anoncreds-shared'

import { AnonCredsModuleConfig } from '../AnonCredsModuleConfig'
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

  const revocationRegistryDefinition = RevocationRegistryDefinition.fromJson(
    anonCredsRevocationRegistryDefinition as unknown as JsonObject
  )

  const revocationStatusList = RevocationStatusList.fromJson(_revocationStatusList as unknown as JsonObject)
  const revocationState = revocationRegistryIndex
    ? CredentialRevocationState.create({
        revocationRegistryIndex: Number(revocationRegistryIndex),
        revocationRegistryDefinition: revocationRegistryDefinition,
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

export const getW3cAnonCredsCredentialMetadata = (w3cJsonLdVerifiableCredential: W3cJsonLdVerifiableCredential) => {
  const w3cJsonLdVerifiableCredentialJson = JsonTransformer.toJSON(w3cJsonLdVerifiableCredential)

  const { schemaId, credentialDefinitionId, revocationRegistryId } = AnonCredsW3cCredential.fromJson(
    w3cJsonLdVerifiableCredentialJson
  )

  return {
    schemaId,
    credentialDefinitionId,
    revocationRegistryId,
  }
}
