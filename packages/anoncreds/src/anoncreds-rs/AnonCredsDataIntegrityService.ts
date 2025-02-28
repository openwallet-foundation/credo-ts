import type {
  AgentContext,
  AnoncredsDataIntegrityVerifyPresentation,
  DifPresentationExchangeDefinition,
  DifPresentationExchangeSubmission,
  IAnonCredsDataIntegrityService,
  W3cCredentialRecord,
  W3cJsonLdVerifiableCredential,
} from '@credo-ts/core'
import type { Descriptor, FieldV2, InputDescriptorV1, InputDescriptorV2 } from '@sphereon/pex-models'
import type { AnonCredsProofRequest, AnonCredsRequestedPredicate } from '../models'
import type { CredentialWithRevocationMetadata } from '../models/utils'
import type { AnonCredsCredentialProve, AnonCredsHolderService, CreateW3cPresentationOptions } from '../services'
import type { AnonCredsRsVerifierService } from './AnonCredsRsVerifierService'

import { JSONPath } from '@astronautlabs/jsonpath'
import {
  ANONCREDS_DATA_INTEGRITY_CRYPTOSUITE,
  ClaimFormat,
  CredoError,
  Hasher,
  JsonTransformer,
  TypedArrayEncoder,
  deepEquality,
  injectable,
} from '@credo-ts/core'

import { AnonCredsHolderServiceSymbol, AnonCredsVerifierServiceSymbol } from '../services'
import { fetchCredentialDefinitions, fetchSchemas } from '../utils/anonCredsObjects'
import { bytesToBigint } from '../utils/bytesToBigint'
import { assertLinkSecretsMatch } from '../utils/linkSecret'
import { getAnonCredsTagsFromRecord } from '../utils/w3cAnonCredsUtils'

import { getW3cAnonCredsCredentialMetadata } from './utils'

export type PathComponent = string | number

@injectable()
export class AnonCredsDataIntegrityService implements IAnonCredsDataIntegrityService {
  private getDataIntegrityProof(credential: W3cJsonLdVerifiableCredential) {
    const cryptosuite = ANONCREDS_DATA_INTEGRITY_CRYPTOSUITE
    if (Array.isArray(credential.proof)) {
      const proof = credential.proof.find(
        (proof) => proof.type === 'DataIntegrityProof' && 'cryptosuite' in proof && proof.cryptosuite === cryptosuite
      )
      if (!proof) throw new CredoError(`Could not find ${ANONCREDS_DATA_INTEGRITY_CRYPTOSUITE} proof`)
      return proof
    }

    if (
      credential.proof.type !== 'DataIntegrityProof' ||
      !('cryptosuite' in credential.proof && credential.proof.cryptosuite === cryptosuite)
    ) {
      throw new CredoError(`Could not find ${ANONCREDS_DATA_INTEGRITY_CRYPTOSUITE} proof`)
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

  private async getCredentialMetadataForDescriptor(
    _agentContext: AgentContext,
    descriptorMapObject: Descriptor,
    selectedCredentials: W3cJsonLdVerifiableCredential[]
  ) {
    const credentialExtractionResult = this.extractPathNodes({ verifiableCredential: selectedCredentials }, [
      descriptorMapObject.path,
    ])

    if (credentialExtractionResult.length === 0 || credentialExtractionResult.length > 1) {
      throw new Error('Could not extract credential from presentation submission')
    }

    const w3cJsonLdVerifiableCredential = credentialExtractionResult[0].value as W3cJsonLdVerifiableCredential
    const w3cJsonLdVerifiableCredentialJson = JsonTransformer.toJSON(w3cJsonLdVerifiableCredential)

    const entryIndex = selectedCredentials.findIndex((credential) =>
      deepEquality(JsonTransformer.toJSON(credential), w3cJsonLdVerifiableCredentialJson)
    )
    if (entryIndex === -1) throw new CredoError('Could not find selected credential')

    return {
      entryIndex,
      credential: selectedCredentials[entryIndex],
      ...getW3cAnonCredsCredentialMetadata(w3cJsonLdVerifiableCredential),
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
    }
    throw new CredoError('Unsupported status directive')
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
    agentContext: AgentContext,
    presentationDefinition: DifPresentationExchangeDefinition,
    presentationSubmission: DifPresentationExchangeSubmission,
    credentials: W3cJsonLdVerifiableCredential[],
    challenge: string
  ) => {
    const credentialsProve: AnonCredsCredentialProve[] = []
    const schemaIds = new Set<string>()
    const credentialDefinitionIds = new Set<string>()
    const credentialsWithMetadata: CredentialWithRevocationMetadata[] = []

    const hash = Hasher.hash(TypedArrayEncoder.fromString(challenge), 'sha-256')
    const nonce = bytesToBigint(hash).toString().slice(0, 20)

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

      const { entryIndex, schemaId, credentialDefinitionId, revocationRegistryId, credential } =
        await this.getCredentialMetadataForDescriptor(agentContext, descriptorMapObject, credentials)

      schemaIds.add(schemaId)
      credentialDefinitionIds.add(credentialDefinitionId)

      const requiresRevocationStatus = this.descriptorRequiresRevocationStatus(descriptor)
      if (requiresRevocationStatus && !revocationRegistryId) {
        throw new CredoError('Selected credentials must be revocable but are not')
      }

      credentialsWithMetadata.push({
        credential,
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
      selectedCredentialRecords: W3cCredentialRecord[]
      challenge: string
    }
  ) {
    const { presentationDefinition, presentationSubmission, selectedCredentialRecords, challenge } = options

    const linkSecrets = selectedCredentialRecords
      .map((record) => getAnonCredsTagsFromRecord(record)?.anonCredsLinkSecretId)
      .filter((linkSecretId): linkSecretId is string => linkSecretId !== undefined)

    const linkSecretId = assertLinkSecretsMatch(agentContext, linkSecrets)

    const { anonCredsProofRequest, credentialDefinitionIds, schemaIds, credentialsProve, credentialsWithMetadata } =
      await this.createAnonCredsProofRequestAndMetadata(
        agentContext,
        presentationDefinition,
        presentationSubmission,
        selectedCredentialRecords.map((record) => record.credential) as W3cJsonLdVerifiableCredential[],
        challenge
      )

    const createPresentationOptions: CreateW3cPresentationOptions = {
      linkSecretId,
      proofRequest: anonCredsProofRequest,
      credentialsProve,
      credentialsWithRevocationMetadata: credentialsWithMetadata,
      schemas: await fetchSchemas(agentContext, schemaIds),
      credentialDefinitions: await fetchCredentialDefinitions(agentContext, credentialDefinitionIds),
    }

    const anonCredsHolderService =
      agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)
    const w3cPresentation = await anonCredsHolderService.createW3cPresentation(agentContext, createPresentationOptions)
    return w3cPresentation
  }

  public async verifyPresentation(agentContext: AgentContext, options: AnoncredsDataIntegrityVerifyPresentation) {
    const { presentation, presentationDefinition, presentationSubmission, challenge } = options

    const credentialDefinitionIds = new Set<string>()

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

    const { anonCredsProofRequest, credentialsWithMetadata } = await this.createAnonCredsProofRequestAndMetadata(
      agentContext,
      presentationDefinition,
      presentationSubmission,
      verifiableCredentials as W3cJsonLdVerifiableCredential[],
      challenge
    )

    const credentialDefinitions = await fetchCredentialDefinitions(agentContext, credentialDefinitionIds)
    const schemaIds = new Set(Object.values(credentialDefinitions).map((cd) => cd.schemaId))
    const schemas = await fetchSchemas(agentContext, schemaIds)

    const anonCredsVerifierService =
      agentContext.dependencyManager.resolve<AnonCredsRsVerifierService>(AnonCredsVerifierServiceSymbol)

    return await anonCredsVerifierService.verifyW3cPresentation(agentContext, {
      credentialsWithRevocationMetadata: credentialsWithMetadata,
      presentation,
      proofRequest: anonCredsProofRequest,
      schemas,
      credentialDefinitions,
    })
  }
}
