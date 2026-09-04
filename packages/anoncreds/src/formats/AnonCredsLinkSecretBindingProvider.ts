import type { AgentContext, JsonObject } from '@credo-ts/core'
import {
  CredoError,
  injectable,
  JsonTransformer,
  W3cCredential,
  W3cCredentialService,
  W3cJsonLdVerifiableCredential,
} from '@credo-ts/core'
import type {
  AnonCredsLinkSecretBindingMethod,
  AnonCredsLinkSecretDataIntegrityBindingProof,
  DidCommCredentialPreviewAttributeOptions,
  DidCommDataIntegrityLinkSecretBindingProvider,
  DidCommDataIntegrityLinkSecretCreateBindingProofOptions,
  DidCommDataIntegrityLinkSecretCreateOfferBindingMethodOptions,
  DidCommDataIntegrityLinkSecretIssueCredentialOptions,
  DidCommDataIntegrityLinkSecretStoreCredentialOptions,
} from '@credo-ts/didcomm'
import { DidCommCredentialPreviewAttribute } from '@credo-ts/didcomm'
import type { AnonCredsRevocationStatusList } from '../models'
import {
  AnonCredsCredentialDefinitionRepository,
  AnonCredsRevocationRegistryDefinitionPrivateRepository,
  AnonCredsRevocationRegistryState,
} from '../repository'
import type { AnonCredsHolderService, AnonCredsIssuerService } from '../services'
import { AnonCredsHolderServiceSymbol, AnonCredsIssuerServiceSymbol } from '../services'
import {
  dateToTimestamp,
  fetchCredentialDefinition,
  fetchRevocationRegistryDefinition,
  fetchRevocationStatusList,
  fetchSchema,
} from '../utils'
import {
  assertAttributesMatch as assertAttributesMatchSchema,
  convertAttributesToCredentialValues,
} from '../utils/credential'
import type { AnonCredsCredentialMetadata, AnonCredsCredentialRequestMetadata } from '../utils/metadata'
import { AnonCredsCredentialMetadataKey, AnonCredsCredentialRequestMetadataKey } from '../utils/metadata'
import { getAnonCredsTagsFromRecord } from '../utils/w3cAnonCredsUtils'

/**
 * Implements the `anoncreds_link_secret` binding method of the W3C Data Integrity credential
 * attachment format (Aries RFC 0809), binding a credential to the holder's anoncreds link secret.
 *
 * Registered by the `AnonCredsModule`, which is what makes the binding method available to the
 * data integrity credential format in `@credo-ts/didcomm`.
 */
@injectable()
export class AnonCredsLinkSecretBindingProvider implements DidCommDataIntegrityLinkSecretBindingProvider {
  public async createOfferBindingMethod(
    agentContext: AgentContext,
    options: DidCommDataIntegrityLinkSecretCreateOfferBindingMethodOptions
  ): Promise<AnonCredsLinkSecretBindingMethod> {
    const {
      credentialExchangeRecord,
      credentialDefinitionId,
      revocationRegistryDefinitionId,
      revocationRegistryIndex,
      offeredCredential,
    } = options

    const anoncredsCredentialOffer = await agentContext.dependencyManager
      .resolve<AnonCredsIssuerService>(AnonCredsIssuerServiceSymbol)
      .createCredentialOffer(agentContext, { credentialDefinitionId })

    // We check locally for credential definition info. If it supports revocation, revocationRegistryIndex
    // and revocationRegistryDefinitionId are mandatory
    const { credentialDefinition } = await agentContext.dependencyManager
      .resolve(AnonCredsCredentialDefinitionRepository)
      .getByCredentialDefinitionId(agentContext, anoncredsCredentialOffer.cred_def_id)

    if (credentialDefinition.value.revocation) {
      if (!revocationRegistryDefinitionId || !revocationRegistryIndex) {
        throw new CredoError(
          'AnonCreds revocable credentials require revocationRegistryDefinitionId and revocationRegistryIndex'
        )
      }

      // Set revocation tags
      credentialExchangeRecord.setTags({
        anonCredsRevocationRegistryId: revocationRegistryDefinitionId,
        anonCredsCredentialRevocationId: revocationRegistryIndex.toString(),
      })
    }

    await this.assertCredentialAttributesMatchSchemaAttributes(
      agentContext,
      JsonTransformer.fromJSON(offeredCredential, W3cCredential),
      credentialDefinition.schemaId,
      false
    )

    credentialExchangeRecord.metadata.set<AnonCredsCredentialMetadata>(AnonCredsCredentialMetadataKey, {
      schemaId: anoncredsCredentialOffer.schema_id,
      credentialDefinitionId: credentialDefinitionId,
      credentialRevocationId: revocationRegistryIndex?.toString(),
      revocationRegistryId: revocationRegistryDefinitionId,
    })

    return {
      credentialDefinitionId: anoncredsCredentialOffer.cred_def_id,
      keyCorrectnessProof: anoncredsCredentialOffer.key_correctness_proof,
      nonce: anoncredsCredentialOffer.nonce,
    }
  }

  public async createBindingProof(
    agentContext: AgentContext,
    options: DidCommDataIntegrityLinkSecretCreateBindingProofOptions
  ): Promise<AnonCredsLinkSecretDataIntegrityBindingProof> {
    const { credentialExchangeRecord, bindingMethod, linkSecretId } = options

    const anonCredsHolderService =
      agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    const credentialDefinitionReturn = await fetchCredentialDefinition(
      agentContext,
      bindingMethod.credentialDefinitionId
    )

    const { credentialRequest: anonCredsCredentialRequest, credentialRequestMetadata } =
      await anonCredsHolderService.createCredentialRequest(agentContext, {
        credentialOffer: {
          schema_id: credentialDefinitionReturn.credentialDefinition.schemaId,
          cred_def_id: bindingMethod.credentialDefinitionId,
          key_correctness_proof: bindingMethod.keyCorrectnessProof,
          nonce: bindingMethod.nonce,
        },
        credentialDefinition: credentialDefinitionReturn.credentialDefinition,
        linkSecretId,
      })

    if (!anonCredsCredentialRequest.entropy) throw new CredoError('Missing entropy for anonCredsCredentialRequest')

    credentialExchangeRecord.metadata.set<AnonCredsCredentialMetadata>(AnonCredsCredentialMetadataKey, {
      credentialDefinitionId: bindingMethod.credentialDefinitionId,
      schemaId: credentialDefinitionReturn.credentialDefinition.schemaId,
    })
    credentialExchangeRecord.metadata.set<AnonCredsCredentialRequestMetadata>(
      AnonCredsCredentialRequestMetadataKey,
      credentialRequestMetadata
    )

    return anonCredsCredentialRequest as AnonCredsLinkSecretDataIntegrityBindingProof
  }

  public async issueBoundCredential(
    agentContext: AgentContext,
    options: DidCommDataIntegrityLinkSecretIssueCredentialOptions
  ): Promise<JsonObject> {
    const { credentialExchangeRecord, bindingMethod, bindingProof, credentialSubjectId } = options

    const linkSecretMetadata =
      credentialExchangeRecord.metadata.get<AnonCredsCredentialMetadata>(AnonCredsCredentialMetadataKey)
    if (!linkSecretMetadata) throw new CredoError('Missing anoncreds link secret metadata')

    const credentialAttributes = credentialExchangeRecord.credentialAttributes
    if (!credentialAttributes) {
      throw new CredoError(
        `Missing required credential attribute values on credential record with id ${credentialExchangeRecord.id}`
      )
    }

    const credentialSubjectIdAttribute = credentialAttributes.find((ca) => ca.name === 'id')
    if (
      credentialSubjectId &&
      credentialSubjectIdAttribute &&
      credentialSubjectIdAttribute.value !== credentialSubjectId
    ) {
      throw new CredoError('Invalid credential subject id.')
    }
    if (!credentialSubjectIdAttribute && credentialSubjectId) {
      credentialAttributes.push(new DidCommCredentialPreviewAttribute({ name: 'id', value: credentialSubjectId }))
    }

    const anonCredsIssuerService =
      agentContext.dependencyManager.resolve<AnonCredsIssuerService>(AnonCredsIssuerServiceSymbol)

    const credentialDefinition = (
      await agentContext.dependencyManager
        .resolve(AnonCredsCredentialDefinitionRepository)
        .getByCredentialDefinitionId(agentContext, linkSecretMetadata.credentialDefinitionId as string)
    ).credentialDefinition.value

    // We check locally for credential definition info. If it supports revocation, we need to search locally for
    // an active revocation registry
    let revocationRegistryDefinitionId: string | undefined
    let revocationRegistryIndex: number | undefined
    let revocationStatusList: AnonCredsRevocationStatusList | undefined

    if (credentialDefinition.revocation) {
      const { credentialRevocationId, revocationRegistryId } = linkSecretMetadata

      if (!credentialRevocationId || !revocationRegistryId) {
        throw new CredoError(
          'Revocation registry definition id and revocation index are mandatory to issue AnonCreds revocable credentials'
        )
      }

      revocationRegistryDefinitionId = revocationRegistryId
      revocationRegistryIndex = Number(credentialRevocationId)

      const revocationRegistryDefinitionPrivateRecord = await agentContext.dependencyManager
        .resolve(AnonCredsRevocationRegistryDefinitionPrivateRepository)
        .getByRevocationRegistryDefinitionId(agentContext, revocationRegistryDefinitionId)

      if (revocationRegistryDefinitionPrivateRecord.state !== AnonCredsRevocationRegistryState.Active) {
        throw new CredoError(
          `Revocation registry ${revocationRegistryDefinitionId} is in ${revocationRegistryDefinitionPrivateRecord.state} state`
        )
      }

      const revocationStatusListResult = await fetchRevocationStatusList(
        agentContext,
        revocationRegistryDefinitionId,
        dateToTimestamp(new Date())
      )

      revocationStatusList = revocationStatusListResult.revocationStatusList
    }

    const { credential } = await anonCredsIssuerService.createCredential(agentContext, {
      credentialOffer: {
        schema_id: linkSecretMetadata.schemaId as string,
        cred_def_id: bindingMethod.credentialDefinitionId,
        key_correctness_proof: bindingMethod.keyCorrectnessProof,
        nonce: bindingMethod.nonce,
      },
      credentialRequest: bindingProof,
      credentialValues: convertAttributesToCredentialValues(credentialAttributes),
      revocationRegistryDefinitionId,
      revocationRegistryIndex,
      revocationStatusList,
    })

    const { credentialDefinition: anoncredsCredentialDefinition } = await fetchCredentialDefinition(
      agentContext,
      credential.cred_def_id
    )

    const anonCredsHolderService =
      agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)
    const w3cJsonLdVerifiableCredential = await anonCredsHolderService.legacyToW3cCredential(agentContext, {
      credential,
      issuerId: anoncredsCredentialDefinition.issuerId,
    })

    return JsonTransformer.toJSON(w3cJsonLdVerifiableCredential)
  }

  public async storeBoundCredential(
    agentContext: AgentContext,
    options: DidCommDataIntegrityLinkSecretStoreCredentialOptions
  ): Promise<string> {
    const { credentialExchangeRecord, credentialJson, offeredCredentialJson } = options

    const linkSecretRequestMetadata = credentialExchangeRecord.metadata.get<AnonCredsCredentialRequestMetadata>(
      AnonCredsCredentialRequestMetadataKey
    )
    if (!linkSecretRequestMetadata) {
      throw new CredoError('Missing link secret request metadata')
    }

    const integrityProtectedFields = ['@context', 'issuer', 'type', 'credentialSubject', 'validFrom', 'issuanceDate']
    if (Object.keys(offeredCredentialJson).some((key) => !integrityProtectedFields.includes(key) && key !== 'proof')) {
      throw new CredoError('Credential offer contains non anoncreds integrity protected fields.')
    }

    if (!Array.isArray(offeredCredentialJson.type) || offeredCredentialJson?.type.length !== 1) {
      throw new CredoError(`Invalid credential type. Only single credential type 'VerifiableCredential' is supported`)
    }

    if (!credentialExchangeRecord.credentialAttributes) {
      throw new CredoError('Missing credential attributes on credential record. Unable to check credential attributes')
    }

    const anonCredsHolderService =
      agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    const legacyAnonCredsCredential = await anonCredsHolderService.w3cToLegacyCredential(agentContext, {
      credential: JsonTransformer.fromJSON(credentialJson, W3cJsonLdVerifiableCredential),
    })

    const {
      schema_id: schemaId,
      cred_def_id: credentialDefinitionId,
      rev_reg_id: revocationRegistryId,
    } = legacyAnonCredsCredential

    const schemaReturn = await fetchSchema(agentContext, schemaId)
    const credentialDefinitionReturn = await fetchCredentialDefinition(agentContext, credentialDefinitionId)
    const revocationRegistryDefinitionReturn = revocationRegistryId
      ? await fetchRevocationRegistryDefinition(agentContext, revocationRegistryId)
      : undefined

    // This is required to process the credential
    const w3cJsonLdVerifiableCredential = await anonCredsHolderService.legacyToW3cCredential(agentContext, {
      credential: legacyAnonCredsCredential,
      issuerId: credentialJson.issuer as string,
      processOptions: {
        credentialRequestMetadata: linkSecretRequestMetadata,
        credentialDefinition: credentialDefinitionReturn.credentialDefinition,
        revocationRegistryDefinition: revocationRegistryDefinitionReturn?.revocationRegistryDefinition,
      },
    })

    const w3cCredentialRecordId = await anonCredsHolderService.storeCredential(agentContext, {
      credential: w3cJsonLdVerifiableCredential,
      schema: schemaReturn.schema,
      credentialDefinitionId,
      credentialDefinition: credentialDefinitionReturn.credentialDefinition,
      credentialRequestMetadata: linkSecretRequestMetadata,
      revocationRegistry: revocationRegistryDefinitionReturn
        ? {
            id: revocationRegistryId as string,
            definition: revocationRegistryDefinitionReturn?.revocationRegistryDefinition,
          }
        : undefined,
    })

    const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)
    const w3cCredentialRecord = await w3cCredentialService.getCredentialRecordById(agentContext, w3cCredentialRecordId)

    // If the credential is revocable, store the revocation identifiers in the credential record
    if (revocationRegistryId) {
      const linkSecretMetadata =
        credentialExchangeRecord.metadata.get<AnonCredsCredentialMetadata>(AnonCredsCredentialMetadataKey)
      if (!linkSecretMetadata) throw new CredoError('Missing link secret metadata')

      const anonCredsTags = getAnonCredsTagsFromRecord(w3cCredentialRecord)
      if (!anonCredsTags) throw new CredoError('Missing anoncreds tags on credential record.')

      linkSecretMetadata.revocationRegistryId = revocationRegistryDefinitionReturn?.revocationRegistryDefinitionId
      linkSecretMetadata.credentialRevocationId = anonCredsTags.anonCredsCredentialRevocationId?.toString()
      credentialExchangeRecord.metadata.set<AnonCredsCredentialMetadata>(
        AnonCredsCredentialMetadataKey,
        linkSecretMetadata
      )
    }

    await this.assertCredentialAttributesMatchSchemaAttributes(
      agentContext,
      w3cCredentialRecord.firstCredential as W3cCredential,
      getAnonCredsTagsFromRecord(w3cCredentialRecord)?.anonCredsSchemaId as string,
      true
    )

    return w3cCredentialRecord.id
  }

  public async ownsCredentialRecord(agentContext: AgentContext, credentialRecordId: string): Promise<boolean> {
    const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)

    try {
      const w3cCredentialRecord = await w3cCredentialService.getCredentialRecordById(agentContext, credentialRecordId)
      return getAnonCredsTagsFromRecord(w3cCredentialRecord) !== undefined
    } catch {
      return false
    }
  }

  public async deleteCredentialById(agentContext: AgentContext, credentialRecordId: string): Promise<void> {
    const anonCredsHolderService =
      agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    await anonCredsHolderService.deleteCredential(agentContext, credentialRecordId)
  }

  private previewAttributesFromCredential(credential: W3cCredential): DidCommCredentialPreviewAttributeOptions[] {
    if (Array.isArray(credential.credentialSubject)) {
      throw new CredoError('Credential subject must be an object.')
    }

    const claims = {
      ...credential.credentialSubject.claims,
      ...(credential.credentialSubject.id && { id: credential.credentialSubject.id }),
    } as Record<string, string | number>

    return Object.entries(claims).map(([key, value]): DidCommCredentialPreviewAttributeOptions => {
      return { name: key, value: value.toString() }
    })
  }

  private async assertCredentialAttributesMatchSchemaAttributes(
    agentContext: AgentContext,
    credential: W3cCredential,
    schemaId: string,
    credentialSubjectIdMustBeSet: boolean
  ) {
    const attributes = this.previewAttributesFromCredential(credential)

    const schemaReturn = await fetchSchema(agentContext, schemaId)

    const enhancedAttributes = [...attributes]
    if (
      !credentialSubjectIdMustBeSet &&
      schemaReturn.schema.attrNames.includes('id') &&
      attributes.find((attr) => attr.name === 'id') === undefined
    )
      enhancedAttributes.push({ name: 'id', value: 'mock' })
    assertAttributesMatchSchema(schemaReturn.schema, enhancedAttributes)

    return { attributes }
  }
}
