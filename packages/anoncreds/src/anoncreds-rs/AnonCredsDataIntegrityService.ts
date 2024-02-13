import type {
  AnonCredsSchema,
  AnonCredsCredentialDefinition,
  AnonCredsNonRevokedInterval,
  AnonCredsProofRequest,
  AnonCredsRequestedPredicate,
} from '../models'
import type {
  AgentContext,
  IAnoncredsDataIntegrityService,
  AnoncredsDataIntegrityVerifyPresentation,
  DifPresentationExchangeDefinition,
  DifPresentationExchangeSubmission,
  JsonObject,
  W3cCredentialRecord,
  W3cJsonLdVerifiableCredential,
} from '@credo-ts/core'
import type {
  CreateW3cPresentationOptions,
  CredentialProve,
  NonRevokedIntervalOverride,
  VerifyW3cPresentationOptions,
  W3cCredentialEntry,
} from '@hyperledger/anoncreds-shared'
import type { Descriptor, FieldV2, InputDescriptorV1, InputDescriptorV2 } from '@sphereon/pex-models'

import { JSONPath } from '@astronautlabs/jsonpath'
import {
  CredoError,
  Hasher,
  JsonTransformer,
  TypedArrayEncoder,
  AnoncredsDataIntegrityCryptosuite,
  deepEquality,
  injectable,
  ClaimFormat,
} from '@credo-ts/core'
import {
  W3cCredential as AnonCredsW3cCredential,
  W3cPresentation as AnonCredsW3cPresentation,
  CredentialRevocationState,
  RevocationRegistryDefinition,
  RevocationStatusList,
} from '@hyperledger/anoncreds-shared'
import BigNumber from 'bn.js'

import { AnonCredsModuleConfig } from '../AnonCredsModuleConfig'
import {
  assertBestPracticeRevocationInterval,
  fetchCredentialDefinition,
  fetchRevocationRegistryDefinition,
  fetchRevocationStatusList,
  fetchSchema,
} from '../utils'
import { getAnonCredsTagsFromRecord } from '../utils/w3cAnonCredsUtils'

import { AnonCredsRsHolderService } from './AnonCredsRsHolderService'
import { AnonCredsRsVerifierService } from './AnonCredsRsVerifierService'

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
export class AnonCredsDataIntegrityService implements IAnoncredsDataIntegrityService {
  private getDataIntegrityProof(credential: W3cJsonLdVerifiableCredential) {
    const cryptosuite = AnoncredsDataIntegrityCryptosuite
    if (Array.isArray(credential.proof)) {
      const proof = credential.proof.find(
        (proof) => proof.type === 'DataIntegrityProof' && 'cryptosuite' in proof && proof.cryptosuite === cryptosuite
      )
      if (!proof) throw new CredoError(`Could not find ${AnoncredsDataIntegrityCryptosuite} proof`)
      return proof
    }

    if (
      credential.proof.type !== 'DataIntegrityProof' ||
      !('cryptosuite' in credential.proof && credential.proof.cryptosuite === cryptosuite)
    ) {
      throw new CredoError(`Could not find ${AnoncredsDataIntegrityCryptosuite} proof`)
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

  private getCredentialMetadataForDescriptor(descriptorMapObject: Descriptor, selectedCredentials: JsonObject[]) {
    const credentialExtractionResult = this.extractPathNodes({ verifiableCredential: selectedCredentials }, [
      descriptorMapObject.path,
    ])

    if (credentialExtractionResult.length === 0 || credentialExtractionResult.length > 1) {
      throw new Error('Could not extract credential from presentation submission')
    }

    const credentialJson = credentialExtractionResult[0].value as JsonObject

    // FIXME: Is this required?
    const entryIndex = selectedCredentials.findIndex((credential) => deepEquality(credential, credentialJson))
    if (entryIndex === -1) throw new CredoError('Could not find selected credential')

    const { credentialDefinitionId, revocationRegistryId, schemaId } = AnonCredsW3cCredential.fromJson(credentialJson)

    return {
      entryIndex,
      credentialJson,
      credentialDefinitionId,
      revocationRegistryId,
      schemaId,
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
      throw new CredoError('Invalid revocation metadata')
    }

    // Make sure the revocation interval follows best practices from Aries RFC 0441
    assertBestPracticeRevocationInterval(nonRevokedInterval)

    const revocaitonRegistryDefinitionResult = await fetchRevocationRegistryDefinition(
      agentContext,
      revocationRegistryId
    )

    const tailsFileService = agentContext.dependencyManager.resolve(AnonCredsModuleConfig).tailsFileService
    const { tailsFilePath } = await tailsFileService.getTailsFile(agentContext, {
      revocationRegistryDefinition: revocaitonRegistryDefinitionResult.revocationRegistryDefinition,
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
      revocaitonRegistryDefinitionResult.revocationRegistryDefinition as unknown as JsonObject
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
      revocationState,
      nonRevokedIntervalOverride,
    }
  }

  private async getSchemas(agentContext: AgentContext, schemaIds: Set<string>) {
    const schemaFetchPromises = [...schemaIds].map(async (schemaId): Promise<[string, AnonCredsSchema]> => {
      const { schema } = await fetchSchema(agentContext, schemaId)
      return [schemaId, schema]
    })

    const schemas = Object.fromEntries(await Promise.all(schemaFetchPromises))
    return schemas
  }

  private async getCredentialDefinitions(agentContext: AgentContext, credentialDefinitionIds: Set<string>) {
    const credentialDefinitionEntries = [...credentialDefinitionIds].map(
      async (credentialDefinitionId): Promise<[string, AnonCredsCredentialDefinition]> => {
        const { credentialDefinition } = await fetchCredentialDefinition(agentContext, credentialDefinitionId)
        return [credentialDefinitionId, credentialDefinition]
      }
    )

    const credentialDefinitions = Object.fromEntries(await Promise.all(credentialDefinitionEntries))
    return credentialDefinitions
  }

  private async getLinkSecret(agentContext: AgentContext, credentialRecord: W3cCredentialRecord[]) {
    const linkSecrets = credentialRecord
      .map((record) => getAnonCredsTagsFromRecord(record)?.anonCredsLinkSecretId)
      .filter((linkSecretId): linkSecretId is string => linkSecretId !== undefined)

    const anoncredsHolderService = agentContext.dependencyManager.resolve(AnonCredsRsHolderService)
    return anoncredsHolderService.getLinkSecret(agentContext, linkSecrets)
  }

  private getPresentationMetadata = async (
    agentContext: AgentContext,
    options: {
      credentialsWithMetadata: CredentialWithMetadata[]
      credentialsProve: CredentialProve[]
      schemaIds: Set<string>
      credentialDefinitionIds: Set<string>
    }
  ) => {
    const { credentialDefinitionIds, schemaIds, credentialsWithMetadata, credentialsProve } = options

    const credentials: W3cCredentialEntry[] = await Promise.all(
      credentialsWithMetadata.map(async ({ credential, nonRevoked }) => {
        const { revocationRegistryIndex, revocationRegistryId, timestamp } = AnonCredsW3cCredential.fromJson(credential)

        if (!nonRevoked) return { credential, revocationState: undefined, timestamp: undefined }

        if (!revocationRegistryId || !revocationRegistryIndex) throw new CredoError('Missing revocation metadata')

        const { revocationState, updatedTimestamp } = await this.getRevocationMetadata(agentContext, {
          nonRevokedInterval: nonRevoked,
          timestamp,
          revocationRegistryIndex,
          revocationRegistryId,
        })

        return { credential, revocationState, timestamp: updatedTimestamp }
      })
    )

    const schemas = await this.getSchemas(agentContext, schemaIds)
    const credentialDefinitions = await this.getCredentialDefinitions(agentContext, credentialDefinitionIds)

    return {
      schemas,
      credentialDefinitions,
      credentialsProve,
      credentials,
    }
  }

  private descriptorRequiresRevocationStatus(descriptor: InputDescriptorV1 | InputDescriptorV2) {
    const statuses = descriptor.constraints?.statuses
    if (!statuses) return false
    if (
      statuses?.active?.directive &&
      (statuses.active.directive === 'allowed' || statuses.active.directive === 'required')
    ) {
      return true
    } else {
      throw new CredoError('Unsupported status directive')
    }
  }

  private getPredicateTypeAndValues(predicateFilter: NonNullable<FieldV2['filter']>) {
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
      if (!predicateType) throw new CredoError(`Unsupported predicate filter property '${key}'`)
      predicates.push({
        predicateType,
        predicateValue: value,
      })
    }

    return predicates
  }

  private getRevocationMetadataForCredentials = async (
    agentContext: AgentContext,
    credentialsWithMetadata: CredentialWithMetadata[]
  ) => {
    const revocationMetadataFetchPromises = credentialsWithMetadata
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
      })

    return await Promise.all(revocationMetadataFetchPromises)
  }

  private getClaimNameForField(field: FieldV2) {
    if (!field.path) throw new CredoError('Field path is required')
    // fixme: could the path start otherwise?
    const baseClaimPath = '$.credentialSubject.'
    const claimPaths = field.path.filter((path) => path.startsWith(baseClaimPath))
    if (claimPaths.length === 0) return undefined

    // FIXME: we should iterate over all attributes of the schema here and check if the path is valid
    // see https://identity.foundation/presentation-exchange/#presentation-definition
    const claimNames = claimPaths.map((path) => path.slice(baseClaimPath.length))
    const propertyName = claimNames[0]

    return propertyName
  }

  public createAnonCredsProofRequestAndMetadata = async (
    presentationDefinition: DifPresentationExchangeDefinition,
    presentationSubmission: DifPresentationExchangeSubmission,
    credentials: JsonObject[],
    challenge: string
  ) => {
    const credentialsProve: CredentialProve[] = []
    const schemaIds = new Set<string>()
    const credentialDefinitionIds = new Set<string>()
    const credentialsWithMetadata: CredentialWithMetadata[] = []

    const hash = Hasher.hash(TypedArrayEncoder.fromString(challenge), 'sha-256')
    const nonce = new BigNumber(hash).toString().slice(0, 20)

    const anonCredsProofRequest: AnonCredsProofRequest = {
      version: '1.0',
      name: presentationDefinition.name ?? 'Proof request',
      nonce,
      requested_attributes: {},
      requested_predicates: {},
    }

    const nonRevoked = Math.floor(Date.now() / 1000)
    const nonRevokedInterval = { from: nonRevoked, to: nonRevoked }

    for (const descriptorMapObject of presentationSubmission.descriptor_map) {
      const descriptor: InputDescriptorV1 | InputDescriptorV2 | undefined = (
        presentationDefinition.input_descriptors as InputDescriptorV2[]
      ).find((descriptor) => descriptor.id === descriptorMapObject.id)

      if (!descriptor) {
        throw new Error(`Descriptor with id ${descriptorMapObject.id} not found in presentation definition`)
      }

      const referent = descriptorMapObject.id
      const attributeReferent = `${referent}_attribute`
      const predicateReferentBase = `${referent}_predicate`
      let predicateReferentIndex = 0

      const fields = descriptor.constraints?.fields
      if (!fields) throw new CredoError('Unclear mapping of constraint with no fields.')

      const { entryIndex, schemaId, credentialDefinitionId, revocationRegistryId, credentialJson } =
        this.getCredentialMetadataForDescriptor(descriptorMapObject, credentials)

      schemaIds.add(schemaId)
      credentialDefinitionIds.add(credentialDefinitionId)

      const requiresRevocationStatus = this.descriptorRequiresRevocationStatus(descriptor)
      if (requiresRevocationStatus && !revocationRegistryId) {
        throw new CredoError('Selected credentials must be revocable but are not')
      }

      credentialsWithMetadata.push({
        credential: credentialJson,
        nonRevoked: requiresRevocationStatus ? nonRevokedInterval : undefined,
      })

      for (const field of fields) {
        const propertyName = this.getClaimNameForField(field)
        if (!propertyName) continue

        if (field.predicate) {
          if (!field.filter) throw new CredoError('Missing required predicate filter property.')
          const predicateTypeAndValues = this.getPredicateTypeAndValues(field.filter)
          for (const { predicateType, predicateValue } of predicateTypeAndValues) {
            const predicateReferent = `${predicateReferentBase}_${predicateReferentIndex++}`
            anonCredsProofRequest.requested_predicates[predicateReferent] = {
              name: propertyName,
              p_type: predicateType,
              p_value: predicateValue,
              restrictions: [{ cred_def_id: credentialDefinitionId }],
              non_revoked: requiresRevocationStatus ? nonRevokedInterval : undefined,
            }

            credentialsProve.push({ entryIndex, referent: predicateReferent, isPredicate: true, reveal: true })
          }
        } else {
          if (!anonCredsProofRequest.requested_attributes[attributeReferent]) {
            anonCredsProofRequest.requested_attributes[attributeReferent] = {
              names: [propertyName],
              restrictions: [{ cred_def_id: credentialDefinitionId }],
              non_revoked: requiresRevocationStatus ? nonRevokedInterval : undefined,
            }
          } else {
            const names = anonCredsProofRequest.requested_attributes[attributeReferent].names ?? []
            anonCredsProofRequest.requested_attributes[attributeReferent].names = [...names, propertyName]
          }

          credentialsProve.push({ entryIndex, referent: attributeReferent, isPredicate: false, reveal: true })
        }
      }
    }

    return { anonCredsProofRequest, credentialsWithMetadata, credentialsProve, schemaIds, credentialDefinitionIds }
  }

  public async createPresentation(
    agentContext: AgentContext,
    options: {
      presentationDefinition: DifPresentationExchangeDefinition
      presentationSubmission: DifPresentationExchangeSubmission
      selectedCredentials: JsonObject[]
      selectedCredentialRecords: W3cCredentialRecord[]
      challenge: string
    }
  ) {
    const {
      presentationDefinition,
      presentationSubmission,
      selectedCredentialRecords,
      selectedCredentials,
      challenge,
    } = options

    const linkSecret = await this.getLinkSecret(agentContext, selectedCredentialRecords)

    const { anonCredsProofRequest, ...metadata } = await this.createAnonCredsProofRequestAndMetadata(
      presentationDefinition,
      presentationSubmission,
      selectedCredentials,
      challenge
    )

    const presentationMetadata = await this.getPresentationMetadata(agentContext, metadata)

    const { schemas, credentialDefinitions, credentialsProve, credentials } = presentationMetadata

    const anonCredsRsHolderService = agentContext.dependencyManager.resolve(AnonCredsRsHolderService)

    const createPresentationOptions: CreateW3cPresentationOptions = {
      credentials,
      schemas: schemas as unknown as Record<string, JsonObject>,
      credentialDefinitions: credentialDefinitions as unknown as Record<string, JsonObject>,
      linkSecret,
      credentialsProve,
      presentationRequest: anonCredsProofRequest as unknown as JsonObject,
    }

    const w3cPresentation = await anonCredsRsHolderService.createW3cPresentation(createPresentationOptions)
    return w3cPresentation as JsonObject
  }

  public async verifyPresentation(agentContext: AgentContext, options: AnoncredsDataIntegrityVerifyPresentation) {
    const { presentation, presentationDefinition, presentationSubmission, challenge } = options

    let anonCredsW3cPresentation: AnonCredsW3cPresentation | undefined

    let result = false

    const credentialDefinitionIds = new Set<string>()
    try {
      const verifiableCredentials = Array.isArray(presentation.verifiableCredential)
        ? presentation.verifiableCredential
        : [presentation.verifiableCredential]

      for (const verifiableCredential of verifiableCredentials) {
        if (verifiableCredential.claimFormat === ClaimFormat.LdpVc) {
          const proof = this.getDataIntegrityProof(verifiableCredential)
          credentialDefinitionIds.add(proof.verificationMethod)
        } else {
          throw new CredoError('Unsupported credential type')
        }
      }

      const verifiableCredentialsJson = verifiableCredentials.map((credential) => JsonTransformer.toJSON(credential))
      const { anonCredsProofRequest, ...metadata } = await this.createAnonCredsProofRequestAndMetadata(
        presentationDefinition,
        presentationSubmission,
        verifiableCredentialsJson,
        challenge
      )
      const revocationMetadata = await this.getRevocationMetadataForCredentials(
        agentContext,
        metadata.credentialsWithMetadata
      )

      const credentialDefinitions = await this.getCredentialDefinitions(agentContext, credentialDefinitionIds)
      const schemaIds = new Set(Object.values(credentialDefinitions).map((cd) => cd.schemaId))
      const schemas = await this.getSchemas(agentContext, schemaIds)

      const presentationJson = JsonTransformer.toJSON(presentation)
      anonCredsW3cPresentation = AnonCredsW3cPresentation.fromJson(presentationJson)

      const revocationRegistryDefinitions: Record<string, RevocationRegistryDefinition> = {}
      revocationMetadata.forEach(
        (rm) => (revocationRegistryDefinitions[rm.revocationRegistryId] = rm.revocationRegistryDefinition)
      )

      const verificationOptions: VerifyW3cPresentationOptions = {
        presentationRequest: anonCredsProofRequest as unknown as JsonObject,
        schemas: schemas as unknown as Record<string, JsonObject>,
        credentialDefinitions: credentialDefinitions as unknown as Record<string, JsonObject>,
        revocationRegistryDefinitions,
        revocationStatusLists: revocationMetadata.map((rm) => rm.revocationStatusList),
        nonRevokedIntervalOverrides: revocationMetadata
          .filter((rm) => rm.nonRevokedIntervalOverride)
          .map((rm) => rm.nonRevokedIntervalOverride as NonRevokedIntervalOverride),
      }
      const anonCredsRsVerifierService = agentContext.dependencyManager.resolve(AnonCredsRsVerifierService)
      result = anonCredsRsVerifierService.verifyW3cPresentation(presentation, verificationOptions)
    } finally {
      anonCredsW3cPresentation?.handle.clear()
    }

    return result
  }
}
