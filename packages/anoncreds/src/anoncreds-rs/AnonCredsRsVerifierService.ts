import type { AgentContext } from '@credo-ts/core'
import type {
  JsonObject,
  NonRevokedIntervalOverride,
  RevocationRegistryDefinition,
  VerifyW3cPresentationOptions as VerifyAnonCredsW3cPresentationOptions,
} from '@hyperledger/anoncreds-shared'
import type { AnonCredsNonRevokedInterval, AnonCredsProof, AnonCredsProofRequest } from '../models'
import type { CredentialWithRevocationMetadata } from '../models/utils'
import type { AnonCredsVerifierService, VerifyProofOptions, VerifyW3cPresentationOptions } from '../services'

import { JsonTransformer, injectable } from '@credo-ts/core'
import { W3cCredential as AnonCredsW3cCredential, Presentation, W3cPresentation } from '@hyperledger/anoncreds-shared'

import { fetchRevocationStatusList } from '../utils'

import { getRevocationMetadata } from './utils'

@injectable()
export class AnonCredsRsVerifierService implements AnonCredsVerifierService {
  public async verifyProof(agentContext: AgentContext, options: VerifyProofOptions): Promise<boolean> {
    const { credentialDefinitions, proof, proofRequest, revocationRegistries, schemas } = options

    let presentation: Presentation | undefined
    try {
      // Check that provided timestamps correspond to the active ones from the VDR. If they are and differ from the originally
      // requested ones, create overrides for anoncreds-rs to consider them valid
      const { verified, nonRevokedIntervalOverrides } = await this.verifyTimestamps(agentContext, proof, proofRequest)

      // No need to call anoncreds-rs as we already know that the proof will not be valid
      if (!verified) {
        agentContext.config.logger.debug('Invalid timestamps for provided identifiers')
        return false
      }

      presentation = Presentation.fromJson(proof as unknown as JsonObject)

      const rsCredentialDefinitions: Record<string, JsonObject> = {}
      for (const credDefId in credentialDefinitions) {
        rsCredentialDefinitions[credDefId] = credentialDefinitions[credDefId] as unknown as JsonObject
      }

      const rsSchemas: Record<string, JsonObject> = {}
      for (const schemaId in schemas) {
        rsSchemas[schemaId] = schemas[schemaId] as unknown as JsonObject
      }

      const revocationRegistryDefinitions: Record<string, JsonObject> = {}
      const lists: JsonObject[] = []

      for (const revocationRegistryDefinitionId in revocationRegistries) {
        const { definition, revocationStatusLists } = options.revocationRegistries[revocationRegistryDefinitionId]

        revocationRegistryDefinitions[revocationRegistryDefinitionId] = definition as unknown as JsonObject

        lists.push(...(Object.values(revocationStatusLists) as unknown as Array<JsonObject>))
      }

      return presentation.verify({
        presentationRequest: proofRequest as unknown as JsonObject,
        credentialDefinitions: rsCredentialDefinitions,
        schemas: rsSchemas,
        revocationRegistryDefinitions,
        revocationStatusLists: lists,
        nonRevokedIntervalOverrides,
      })
    } finally {
      presentation?.handle.clear()
    }
  }

  private async verifyTimestamps(
    agentContext: AgentContext,
    proof: AnonCredsProof,
    proofRequest: AnonCredsProofRequest
  ): Promise<{ verified: boolean; nonRevokedIntervalOverrides?: NonRevokedIntervalOverride[] }> {
    const nonRevokedIntervalOverrides: NonRevokedIntervalOverride[] = []

    // Override expected timestamps if the requested ones don't exacly match the values from VDR
    const globalNonRevokedInterval = proofRequest.non_revoked

    const requestedNonRevokedRestrictions: {
      nonRevokedInterval: AnonCredsNonRevokedInterval
      schemaId?: string
      credentialDefinitionId?: string
      revocationRegistryDefinitionId?: string
    }[] = []

    for (const value of [
      ...Object.values(proofRequest.requested_attributes),
      ...Object.values(proofRequest.requested_predicates),
    ]) {
      const nonRevokedInterval = value.non_revoked ?? globalNonRevokedInterval
      if (nonRevokedInterval) {
        for (const restriction of value.restrictions ?? []) {
          requestedNonRevokedRestrictions.push({
            nonRevokedInterval,
            schemaId: restriction.schema_id,
            credentialDefinitionId: restriction.cred_def_id,
            revocationRegistryDefinitionId: restriction.rev_reg_id,
          })
        }
      }
    }

    for (const identifier of proof.identifiers) {
      if (!identifier.timestamp || !identifier.rev_reg_id) {
        continue
      }
      const relatedNonRevokedRestrictionItem = requestedNonRevokedRestrictions.find(
        (item) =>
          item.revocationRegistryDefinitionId === identifier.rev_reg_id ||
          item.credentialDefinitionId === identifier.cred_def_id ||
          item.schemaId === identifier.schema_id
      )

      const requestedFrom = relatedNonRevokedRestrictionItem?.nonRevokedInterval.from
      if (requestedFrom && requestedFrom > identifier.timestamp) {
        // Check VDR if the active revocation status list at requestedFrom was the one from provided timestamp.
        // If it matches, add to the override list
        const { revocationStatusList } = await fetchRevocationStatusList(
          agentContext,
          identifier.rev_reg_id,
          requestedFrom
        )

        const vdrTimestamp = revocationStatusList?.timestamp
        if (vdrTimestamp && vdrTimestamp === identifier.timestamp) {
          nonRevokedIntervalOverrides.push({
            overrideRevocationStatusListTimestamp: identifier.timestamp,
            requestedFromTimestamp: requestedFrom,
            revocationRegistryDefinitionId: identifier.rev_reg_id,
          })
        } else {
          agentContext.config.logger.debug(
            `VDR timestamp for ${requestedFrom} does not correspond to the one provided in proof identifiers. Expected: ${identifier.timestamp} and received ${vdrTimestamp}`
          )
          return { verified: false }
        }
      }
    }

    return {
      verified: true,
      nonRevokedIntervalOverrides: nonRevokedIntervalOverrides.length ? nonRevokedIntervalOverrides : undefined,
    }
  }

  private getRevocationMetadataForCredentials = async (
    agentContext: AgentContext,
    credentialsWithMetadata: CredentialWithRevocationMetadata[]
  ) => {
    const revocationMetadataFetchPromises = credentialsWithMetadata
      .filter((cwm) => cwm.nonRevoked)
      .map(async (credentialWithMetadata) => {
        const w3cJsonLdVerifiableCredential = JsonTransformer.toJSON(credentialWithMetadata.credential)
        const { revocationRegistryIndex, revocationRegistryId, timestamp } =
          AnonCredsW3cCredential.fromJson(w3cJsonLdVerifiableCredential)

        return await getRevocationMetadata(agentContext, {
          nonRevokedInterval: credentialWithMetadata.nonRevoked as AnonCredsNonRevokedInterval,
          timestamp: timestamp,
          revocationRegistryId,
          revocationRegistryIndex,
        })
      })

    return await Promise.all(revocationMetadataFetchPromises)
  }

  public async verifyW3cPresentation(agentContext: AgentContext, options: VerifyW3cPresentationOptions) {
    const revocationMetadata = await this.getRevocationMetadataForCredentials(
      agentContext,
      options.credentialsWithRevocationMetadata
    )

    const revocationRegistryDefinitions: Record<string, RevocationRegistryDefinition> = {}
    for (const rm of revocationMetadata) {
      revocationRegistryDefinitions[rm.revocationRegistryId] = rm.revocationRegistryDefinition
    }

    const verificationOptions: VerifyAnonCredsW3cPresentationOptions = {
      presentationRequest: options.proofRequest as unknown as JsonObject,
      schemas: options.schemas as unknown as Record<string, JsonObject>,
      credentialDefinitions: options.credentialDefinitions as unknown as Record<string, JsonObject>,
      revocationRegistryDefinitions,
      revocationStatusLists: revocationMetadata.map((rm) => rm.revocationStatusList),
      nonRevokedIntervalOverrides: revocationMetadata
        .filter((rm) => rm.nonRevokedIntervalOverride)
        .map((rm) => rm.nonRevokedIntervalOverride as NonRevokedIntervalOverride),
    }

    let result = false
    const presentationJson = JsonTransformer.toJSON(options.presentation)
    if ('presentation_submission' in presentationJson) presentationJson.presentation_submission = undefined

    let w3cPresentation: W3cPresentation | undefined
    try {
      w3cPresentation = W3cPresentation.fromJson(presentationJson)
      result = w3cPresentation.verify(verificationOptions)
    } finally {
      w3cPresentation?.handle.clear()
    }
    return result
  }
}
