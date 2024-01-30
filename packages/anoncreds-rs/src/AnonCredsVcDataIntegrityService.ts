import type {
  AnonCredsCredentialDefinition,
  AnonCredsNonRevokedInterval,
  AnonCredsProofRequest,
  AnonCredsRequestedPredicate,
  AnonCredsSchema,
} from '@aries-framework/anoncreds'
import type {
  AgentContext,
  AnonCredsVcDataIntegrityService,
  AnonCredsVcVerificationOptions,
  JsonObject,
  W3cCredentialRecord,
} from '@aries-framework/core'
import type { W3cCredentialEntry, CredentialProve, NonRevokedIntervalOverride } from '@hyperledger/anoncreds-shared'
import type {
  Descriptor,
  FieldV2,
  PresentationDefinitionV1,
  PresentationDefinitionV2,
  PresentationSubmission,
  InputDescriptorV2,
  InputDescriptorV1,
} from '@sphereon/pex-models'

import {
  AnonCredsLinkSecretRepository,
  AnonCredsModuleConfig,
  AnonCredsRegistryService,
  assertBestPracticeRevocationInterval,
  fetchObjectsFromLedger,
} from '@aries-framework/anoncreds'
import {
  W3cJsonLdVerifiableCredential,
  AriesFrameworkError,
  JsonTransformer,
  deepEquality,
  injectable,
} from '@aries-framework/core'
import { JSONPath } from '@astronautlabs/jsonpath'
import {
  W3cCredential as AnonCredsW3cCredential,
  W3cPresentation as AnonCredsW3cPresentation,
  CredentialRevocationState,
  RevocationRegistryDefinition,
  RevocationStatusList,
} from '@hyperledger/anoncreds-shared'

export interface CredentialWithMetadata {
  credential: JsonObject
  nonRevoked?: AnonCredsNonRevokedInterval
  timestamp?: number
}

export interface RevocationRegistryFetchMetadata {
  timestamp?: number
  revocationRegistryId: string
  revocationRegistryIndex?: number
  nonRevokedInterval: AnonCredsNonRevokedInterval
}

export type PathComponent = string | number

@injectable()
export class AnonCredsVc2023DataIntegrityService implements AnonCredsVcDataIntegrityService {
  private getDataIntegrityProof(credential: W3cJsonLdVerifiableCredential, cryptosuite: string) {
    if (Array.isArray(credential.proof)) {
      const proof = credential.proof.find(
        (proof) => proof.type === 'DataIntegrityProof' && proof.cryptosuite === cryptosuite
      )
      if (!proof) throw new AriesFrameworkError('Could not find anoncreds proof')
      return proof
    }

    if (credential.proof.type !== 'DataIntegrityProof' || credential.proof.cryptosuite !== cryptosuite) {
      throw new AriesFrameworkError(
        `Unsupported proof type '${credential.proof.type}' or cryptosuite '${credential.proof.cryptosuite}'.`
      )
    }

    return credential.proof
  }
  private extractPathNodes(obj: unknown, paths: string[]): { value: unknown; path: PathComponent[] }[] {
    let result: { value: unknown; path: PathComponent[] }[] = []
    if (paths) {
      for (const path of paths) {
        result = JSONPath.nodes(obj, path)
        if (result.length) break
      }
    }
    return result
  }

  private getCredentialMetadata(
    entryIndex: number,
    selectedCredentials: JsonObject[],
    selectedCredentialRecords: W3cCredentialRecord[]
  ) {
    const credentialRecord = selectedCredentialRecords[entryIndex]
    if (!deepEquality(JsonTransformer.toJSON(credentialRecord.credential), selectedCredentials[entryIndex])) {
      throw new AriesFrameworkError('selected credential does not match the selected credential record')
    }

    const anonCredsTags = credentialRecord.getAnonCredsTags()
    if (!anonCredsTags) throw new AriesFrameworkError('No anoncreds tags found on credential record')

    return {
      entryIndex,
      credentialRecord,
      anonCredsTags,
    }
  }

  private getCredential(descriptorMapObject: Descriptor, selectedCredentials: JsonObject[]) {
    const presentationWrapper = {
      verifiableCredential: selectedCredentials,
    }

    const credentialExtractionResult = this.extractPathNodes(presentationWrapper, [descriptorMapObject.path])
    if (credentialExtractionResult.length === 0 || credentialExtractionResult.length > 1) {
      throw new Error('Could not extract credential from presentation submission')
    }

    // only available on the holder side
    const jsonLdVerifiableCredentialJson = credentialExtractionResult[0].value

    const entryIndex = selectedCredentials.findIndex((credential) =>
      deepEquality(credential, jsonLdVerifiableCredentialJson)
    )
    if (entryIndex === -1) throw new AriesFrameworkError('Could not find selected credential')

    return {
      entryIndex,
      credential: JsonTransformer.fromJSON(jsonLdVerifiableCredentialJson, W3cJsonLdVerifiableCredential),
      credentialJson: jsonLdVerifiableCredentialJson,
    }
  }

  private async getRevocationMetadata(
    agentContext: AgentContext,
    revocationRegistryFetchMetadata: RevocationRegistryFetchMetadata,
    mustHaveTimeStamp = false
  ) {
    let nonRevokedIntervalOverride: NonRevokedIntervalOverride | undefined

    const { revocationRegistryId, revocationRegistryIndex, nonRevokedInterval, timestamp } =
      revocationRegistryFetchMetadata
    if (!revocationRegistryId || !nonRevokedInterval || (mustHaveTimeStamp && !timestamp)) {
      throw new AriesFrameworkError('Invalid revocation metadata')
    }

    // Make sure the revocation interval follows best practices from Aries RFC 0441
    assertBestPracticeRevocationInterval(nonRevokedInterval)

    const registry = agentContext.dependencyManager
      .resolve(AnonCredsRegistryService)
      .getRegistryForIdentifier(agentContext, revocationRegistryId)

    const { revocationRegistryDefinition: _revocationRegistryDefinition, resolutionMetadata } =
      await registry.getRevocationRegistryDefinition(agentContext, revocationRegistryId)
    if (!_revocationRegistryDefinition) {
      throw new AriesFrameworkError(
        `Could not retrieve revocation registry definition for revocation registry ${revocationRegistryId}: ${resolutionMetadata.message}`
      )
    }

    const tailsFileService = agentContext.dependencyManager.resolve(AnonCredsModuleConfig).tailsFileService
    const { tailsFilePath } = await tailsFileService.getTailsFile(agentContext, {
      revocationRegistryDefinition: _revocationRegistryDefinition,
    })

    const timestampToFetch = timestamp ?? nonRevokedInterval.to
    if (!timestampToFetch) throw new AriesFrameworkError('Timestamp to fetch is required')

    // Fetch revocation status list if we don't already have a revocation status list for the given timestamp
    const { revocationStatusList: _revocationStatusList, resolutionMetadata: statusListResolutionMetadata } =
      await registry.getRevocationStatusList(agentContext, revocationRegistryId, timestampToFetch)

    if (!_revocationStatusList) {
      throw new AriesFrameworkError(
        `Could not retrieve revocation status list for revocation registry ${revocationRegistryId}: ${statusListResolutionMetadata.message}`
      )
    }

    const updatedTimestamp = timestamp ?? _revocationStatusList.timestamp

    const revocationRegistryDefinition = RevocationRegistryDefinition.fromJson(
      _revocationRegistryDefinition as unknown as JsonObject
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
      const { revocationStatusList: overrideRevocationStatusList } = await registry.getRevocationStatusList(
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
        throw new AriesFrameworkError(
          `VDR timestamp for ${requestedFrom} does not correspond to the one provided in proof identifiers. Expected: ${updatedTimestamp} and received ${vdrTimestamp}`
        )
      }
    }

    return {
      updatedTimestamp,
      revocationRegistryDefinition: [revocationRegistryId, revocationRegistryDefinition] as [
        string,
        RevocationRegistryDefinition
      ],
      revocationStatusList,
      revocationState,
      nonRevokedIntervalOverride,
    }
  }

  private async getCredentialDefinitionsAndSchemas(
    agentContext: AgentContext,
    schemaIds: Set<string> | undefined,
    credentialDefinitionIds: Set<string>
  ) {
    const schemaFetchPromises = [...(schemaIds ?? [])].map((schemaId) =>
      fetchObjectsFromLedger(agentContext, { schemaId })
    )
    const credentialDefinitionFetchPromises = [...credentialDefinitionIds].map((credentialDefinitionId) =>
      fetchObjectsFromLedger(agentContext, { credentialDefinitionId })
    )

    const schemas: Record<string, AnonCredsSchema> = {}
    const credentialDefinitions: Record<string, AnonCredsCredentialDefinition> = {}

    const results = await Promise.all([
      Promise.all(schemaFetchPromises),
      Promise.all(credentialDefinitionFetchPromises),
    ])

    const credentialDefinitionFetchResults = results[1]
    for (const res of credentialDefinitionFetchResults) {
      const credentialDefinitionId = res.credentialDefinitionReturn.credentialDefinitionId
      const credentialDefinition = res.credentialDefinitionReturn.credentialDefinition
      if (!credentialDefinition) {
        throw new AriesFrameworkError('Credential definition not found')
      }

      credentialDefinitions[credentialDefinitionId] = credentialDefinition
    }

    const schemaFetchResults =
      schemaFetchPromises.length > 0
        ? results[0]
        : await Promise.all(
            credentialDefinitionFetchResults.map((res) =>
              fetchObjectsFromLedger(agentContext, {
                schemaId: res.credentialDefinitionReturn.credentialDefinition?.schemaId as string,
              })
            )
          )

    for (const schemaFetchResult of schemaFetchResults) {
      const schemaId = schemaFetchResult.schemaReturn.schemaId
      const schema = schemaFetchResult.schemaReturn.schema
      if (!schema) {
        throw new AriesFrameworkError('Credential definition not found')
      }

      schemas[schemaId] = schema
    }

    return {
      schemas,
      credentialDefinitions,
    }
  }

  private getPresentationMetadata = async (
    agentContext: AgentContext,
    input: {
      credentialsWithMetadata: CredentialWithMetadata[]
      credentialsProve: CredentialProve[]
      linkSecretIds: Set<string>
      schemaIds: Set<string>
      credentialDefinitionIds: Set<string>
    }
  ) => {
    const { linkSecretIds, schemaIds, credentialDefinitionIds, credentialsWithMetadata, credentialsProve } = input
    const linkSecretIdArray = [...linkSecretIds]
    if (linkSecretIdArray.length > 1) {
      throw new AriesFrameworkError('Multiple linksecret cannot be used to create a single presentation')
    } else if (linkSecretIdArray.length === 0) {
      throw new AriesFrameworkError('Cannot create a presentation without a linksecret')
    }

    const linkSecretRecord = await agentContext.dependencyManager
      .resolve(AnonCredsLinkSecretRepository)
      .getByLinkSecretId(agentContext, linkSecretIdArray[0])

    if (!linkSecretRecord.value) {
      throw new AriesFrameworkError('Link Secret value not stored')
    }

    const credentials: W3cCredentialEntry[] = await Promise.all(
      credentialsWithMetadata.map(async ({ credential, nonRevoked }) => {
        const { revocationRegistryIndex, revocationRegistryId, timestamp } = AnonCredsW3cCredential.fromJson(credential)

        if (!nonRevoked) {
          return { credential: credential as unknown as JsonObject, revocationState: undefined, timestamp: undefined }
        }

        if (!revocationRegistryId || !revocationRegistryIndex)
          throw new AriesFrameworkError('Missing revocation metadata')

        const { revocationState, updatedTimestamp } = await this.getRevocationMetadata(agentContext, {
          nonRevokedInterval: nonRevoked,
          timestamp,
          revocationRegistryIndex,
          revocationRegistryId,
        })

        return { credential: credential as unknown as JsonObject, revocationState, timestamp: updatedTimestamp }
      })
    )

    const { schemas, credentialDefinitions } = await this.getCredentialDefinitionsAndSchemas(
      agentContext,
      schemaIds,
      credentialDefinitionIds
    )

    return {
      schemas,
      credentialDefinitions,
      linkSecret: linkSecretRecord.value,
      credentialsProve,
      credentials,
    }
  }

  private getPredicateTypeAndValues(predicateFilter?: FieldV2['filter']) {
    if (!predicateFilter) throw new AriesFrameworkError('Predicate filter is required')

    const predicates: {
      predicateType: AnonCredsRequestedPredicate['p_type']
      predicateValue: AnonCredsRequestedPredicate['p_value']
    }[] = []

    const supportedJsonSchemaNumericRangeProperties: Record<string, AnonCredsRequestedPredicate['p_type']> = {
      exclusiveMinimum: '>',
      exclusiveMaximum: '<',
      minimum: '>=',
      maximum: '<=',
    }

    for (const [key, value] of Object.entries(predicateFilter)) {
      if (key === 'type') continue
      const predicateType = supportedJsonSchemaNumericRangeProperties[key]
      if (!predicateType) throw new AriesFrameworkError(`Unsupported predicate filter property '${key}'`)
      predicates.push({
        predicateType,
        predicateValue: value,
      })
    }

    return predicates
  }

  public createAnonCredsProofRequestAndMetadata = async (
    agentContext: AgentContext,
    presentationDefinition: PresentationDefinitionV1 | PresentationDefinitionV2,
    presentationSubmission: PresentationSubmission,
    credentials: JsonObject[],
    holderOpts?: {
      selectedCredentialRecords: W3cCredentialRecord[]
    }
  ) => {
    const credentialsProve: CredentialProve[] = []
    const schemaIds = new Set<string>()
    const credentialDefinitionIds = new Set<string>()
    const linkSecretIds = new Set<string>()
    const credentialsWithMetadata: CredentialWithMetadata[] = []

    const anonCredsProofRequest: AnonCredsProofRequest = {
      version: '1.0',
      name: presentationDefinition.name ?? 'Proof request',
      nonce: presentationDefinition.id,
      requested_attributes: {},
      requested_predicates: {},
    }

    const nonRevoked = Math.floor(Date.now() / 1000)
    const nonRevokedInterval = { from: nonRevoked, to: nonRevoked }

    for (const descriptorMapObject of presentationSubmission.descriptor_map) {
      // PresentationDefinitionV2 is the common denominator
      const descriptor: InputDescriptorV1 | InputDescriptorV2 | undefined = (
        presentationDefinition.input_descriptors as InputDescriptorV2[]
      ).find((descriptor) => descriptor.id === descriptorMapObject.id)
      if (!descriptor)
        throw new Error(`Descriptor with id ${descriptorMapObject.id} not found in presentation definition`)

      const referent = descriptorMapObject.id
      const attributeReferent = `${referent}_attribute`
      const predicateReferentBase = `${referent}_predicate`
      let predicateReferentIndex = 0

      const fields = descriptor.constraints?.fields
      if (!fields) throw new AriesFrameworkError('Unclear mapping of constraint with no fields.')

      const { credential, entryIndex } = this.getCredential(descriptorMapObject, credentials)
      const credentialJson = JsonTransformer.toJSON(credential)
      const { credentialDefinitionId, revocationRegistryId, schemaId } = AnonCredsW3cCredential.fromJson(credentialJson)

      if (holderOpts) {
        const credentialMetadata = this.getCredentialMetadata(
          entryIndex,
          credentials,
          holderOpts.selectedCredentialRecords
        )
        schemaIds.add(schemaId)
        credentialDefinitionIds.add(credentialDefinitionId)
        linkSecretIds.add(credentialMetadata.anonCredsTags.linkSecretId)
      }

      let useNonRevoked = false

      const statuses = descriptor.constraints?.statuses
      if (statuses) {
        if (
          statuses?.active?.directive &&
          (statuses.active.directive === 'allowed' || statuses.active.directive === 'required')
        ) {
          if (!revocationRegistryId) {
            throw new AriesFrameworkError('Selected credentials must be revocable but are not')
          }
          useNonRevoked = true
        } else {
          throw new AriesFrameworkError('Unsupported status directive')
        }
      }

      credentialsWithMetadata.push({
        credential: credentialJson,
        nonRevoked: useNonRevoked ? nonRevokedInterval : undefined,
      })

      for (const field of fields) {
        if (!field.path) throw new AriesFrameworkError('Field path is required')
        // fixme: could the path start otherwise?
        const claimPaths = field.path?.filter((path) => path.startsWith('$.credentialSubject.'))
        if (!claimPaths) throw new AriesFrameworkError('No claim paths found')
        if (claimPaths.length === 0) continue

        const claimNames = claimPaths.map((path) => {
          const parts = path.split('$.credentialSubject.')
          if (parts.length !== 2) throw new AriesFrameworkError('Invalid claim path')
          if (parts[1] === '') throw new AriesFrameworkError('Invalid empty claim name')
          return parts[1]
        })

        const propertyName = claimNames[0]

        if (field.predicate) {
          const predicateTypeAndValues = this.getPredicateTypeAndValues(field.filter)
          for (const { predicateType, predicateValue } of predicateTypeAndValues) {
            const predicateReferent = `${predicateReferentBase}_${predicateReferentIndex++}`
            anonCredsProofRequest.requested_predicates[predicateReferent] = {
              name: propertyName,
              p_type: predicateType,
              p_value: predicateValue,
              restrictions: [{ cred_def_id: credentialDefinitionId }],
              non_revoked: useNonRevoked ? nonRevokedInterval : undefined,
            }

            credentialsProve.push({ entryIndex, referent: predicateReferent, isPredicate: true, reveal: true })
          }
        } else {
          if (!anonCredsProofRequest.requested_attributes[attributeReferent]) {
            anonCredsProofRequest.requested_attributes[attributeReferent] = {
              name: propertyName,
              names: [propertyName],
              restrictions: [{ cred_def_id: credentialDefinitionId }],
              non_revoked: useNonRevoked ? nonRevokedInterval : undefined,
            }
          } else {
            const name = anonCredsProofRequest.requested_attributes[attributeReferent].name
            const names = anonCredsProofRequest.requested_attributes[attributeReferent].names ?? [name ?? 'name']

            anonCredsProofRequest.requested_attributes[attributeReferent].name = undefined
            anonCredsProofRequest.requested_attributes[attributeReferent].names = [...names, propertyName]
          }

          credentialsProve.push({ entryIndex, referent: attributeReferent, isPredicate: false, reveal: true })
        }
      }
    }

    const presentationMetadata = holderOpts
      ? await this.getPresentationMetadata(agentContext, {
          credentialsWithMetadata: credentialsWithMetadata,
          credentialsProve,
          linkSecretIds,
          schemaIds,
          credentialDefinitionIds,
        })
      : undefined

    const revocationMetadata = !holderOpts
      ? await Promise.all(
          credentialsWithMetadata
            .filter((cwm) => cwm.nonRevoked)
            .map(async (credentialWithMetadata) => {
              const { revocationRegistryIndex, revocationRegistryId, timestamp } = AnonCredsW3cCredential.fromJson(
                credentialWithMetadata.credential
              )
              return await this.getRevocationMetadata(agentContext, {
                nonRevokedInterval: credentialWithMetadata.nonRevoked as AnonCredsNonRevokedInterval,
                timestamp: timestamp,
                revocationRegistryId,
                revocationRegistryIndex,
              })
            }, true)
        )
      : undefined

    return { anonCredsProofRequest, presentationMetadata, revocationMetadata }
  }

  public async createPresentation(
    agentContext: AgentContext,
    options: {
      presentationDefinition: PresentationDefinitionV1 | PresentationDefinitionV2
      presentationSubmission: PresentationSubmission
      selectedCredentials: JsonObject[]
      selectedCredentialRecords: W3cCredentialRecord[]
    }
  ) {
    const { presentationDefinition, presentationSubmission, selectedCredentialRecords, selectedCredentials } = options
    const { anonCredsProofRequest, presentationMetadata } = await this.createAnonCredsProofRequestAndMetadata(
      agentContext,
      presentationDefinition,
      presentationSubmission,
      selectedCredentials,
      {
        selectedCredentialRecords,
      }
    )

    if (!presentationMetadata) throw new AriesFrameworkError('Presentation metadata not created')
    const { schemas, credentialDefinitions, linkSecret, credentialsProve, credentials } = presentationMetadata

    let presentation: AnonCredsW3cPresentation | undefined
    try {
      presentation = AnonCredsW3cPresentation.create({
        credentials,
        schemas: schemas as unknown as Record<string, JsonObject>,
        credentialDefinitions: credentialDefinitions as unknown as Record<string, JsonObject>,
        linkSecret,
        credentialsProve,
        presentationRequest: anonCredsProofRequest as unknown as JsonObject,
      })
      const presentationJson = presentation.toJson() as unknown as JsonObject
      return presentationJson
    } finally {
      presentation?.handle.clear()
    }
  }

  public async verifyPresentation(agentContext: AgentContext, options: AnonCredsVcVerificationOptions) {
    const { presentation, presentationDefinition, presentationSubmission } = options

    let anonCredsW3cPresentation: AnonCredsW3cPresentation | undefined
    let result = false
    const credentialDefinitionIds = new Set<string>()
    try {
      const verifiableCredentials = Array.isArray(presentation.verifiableCredential)
        ? presentation.verifiableCredential
        : [presentation.verifiableCredential]

      for (const verifiableCredential of verifiableCredentials) {
        if (verifiableCredential instanceof W3cJsonLdVerifiableCredential) {
          const proof = this.getDataIntegrityProof(verifiableCredential, 'anoncredspresvc-2023')
          credentialDefinitionIds.add(proof.verificationMethod)
        } else {
          throw new AriesFrameworkError('Unsupported credential type')
        }
      }

      const verifiableCredentialsJson = verifiableCredentials.map((credential) => JsonTransformer.toJSON(credential))
      const { anonCredsProofRequest, revocationMetadata } = await this.createAnonCredsProofRequestAndMetadata(
        agentContext,
        presentationDefinition,
        presentationSubmission,
        verifiableCredentialsJson
      )
      if (!revocationMetadata) throw new AriesFrameworkError('Missing revocation metadata')

      const { credentialDefinitions, schemas } = await this.getCredentialDefinitionsAndSchemas(
        agentContext,
        undefined,
        credentialDefinitionIds
      )
      const presentationJson = JsonTransformer.toJSON(presentation)
      anonCredsW3cPresentation = AnonCredsW3cPresentation.fromJson(presentationJson)

      const revocationRegistryDefinitions: Record<string, RevocationRegistryDefinition> = {}
      revocationMetadata.forEach(
        (rm) => (revocationRegistryDefinitions[rm.revocationRegistryDefinition[0]] = rm.revocationRegistryDefinition[1])
      )
      result = anonCredsW3cPresentation.verify({
        presentationRequest: anonCredsProofRequest as unknown as JsonObject,
        schemas: schemas as unknown as Record<string, JsonObject>,
        credentialDefinitions: credentialDefinitions as unknown as Record<string, JsonObject>,
        revocationRegistryDefinitions: revocationRegistryDefinitions,
        revocationStatusLists: revocationMetadata.map((rm) => rm.revocationStatusList),
        nonRevokedIntervalOverrides: revocationMetadata
          .filter((rm) => rm.nonRevokedIntervalOverride)
          .map((rm) => rm.nonRevokedIntervalOverride as NonRevokedIntervalOverride),
      })
    } finally {
      anonCredsW3cPresentation?.handle.clear()
    }

    return result
  }
}
