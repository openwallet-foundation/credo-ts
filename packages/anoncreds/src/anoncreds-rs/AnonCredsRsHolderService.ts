import type {
  AnonCredsCredentialDefinition,
  AnonCredsProof,
  AnonCredsRequestedAttributeMatch,
  AnonCredsRequestedPredicateMatch,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsSchema,
  AnonCredsCredentialRequest,
  AnonCredsCredential,
  AnonCredsCredentialInfo,
  AnonCredsProofRequestRestriction,
} from '../models'
import type { AnonCredsCredentialRecord } from '../repository'
import type {
  GetCredentialsForProofRequestOptions,
  GetCredentialsForProofRequestReturn,
  AnonCredsHolderService,
  CreateLinkSecretOptions,
  CreateLinkSecretReturn,
  CreateProofOptions,
  CreateCredentialRequestOptions,
  CreateCredentialRequestReturn,
  GetCredentialOptions,
  GetCredentialsOptions,
  StoreCredentialOptions,
} from '../services'
import type { AnonCredsCredentialRequestMetadata, W3cAnoncredsCredentialMetadata } from '../utils/metadata'
import type { AgentContext, Query, SimpleQuery } from '@credo-ts/core'
import type {
  CreateW3cPresentationOptions,
  CredentialEntry,
  CredentialProve,
  CredentialRequestMetadata,
  JsonObject,
} from '@hyperledger/anoncreds-shared'

import {
  CredoError,
  JsonTransformer,
  W3cCredentialRecord,
  TypedArrayEncoder,
  W3cCredentialRepository,
  W3cCredentialService,
  W3cJsonLdVerifiableCredential,
  injectable,
  utils,
} from '@credo-ts/core'
import {
  Credential,
  W3cPresentation,
  W3cCredential as AW3cCredential,
  CredentialRequest,
  CredentialRevocationState,
  LinkSecret,
  Presentation,
  RevocationRegistryDefinition,
  RevocationStatusList,
  anoncreds,
  W3cCredential,
} from '@hyperledger/anoncreds-shared'

import { AnonCredsModuleConfig } from '../AnonCredsModuleConfig'
import { AnonCredsRsError } from '../error'
import { AnonCredsRestrictionWrapper } from '../models'
import { AnonCredsCredentialRepository, AnonCredsLinkSecretRepository } from '../repository'
import { AnonCredsRegistryService } from '../services'
import { storeLinkSecret, unqualifiedCredentialDefinitionIdRegex } from '../utils'
import {
  isUnqualifiedCredentialDefinitionId,
  isUnqualifiedIndyDid,
  isUnqualifiedSchemaId,
} from '../utils/indyIdentifiers'
import { W3cAnonCredsCredentialMetadataKey } from '../utils/metadata'
import { getAnoncredsCredentialInfoFromRecord, getW3cRecordAnonCredsTags } from '../utils/w3cAnonCredsUtils'

@injectable()
export class AnonCredsRsHolderService implements AnonCredsHolderService {
  public async createLinkSecret(
    agentContext: AgentContext,
    options?: CreateLinkSecretOptions
  ): Promise<CreateLinkSecretReturn> {
    return {
      linkSecretId: options?.linkSecretId ?? utils.uuid(),
      linkSecretValue: LinkSecret.create(),
    }
  }

  public async getLinkSecret(agentContext: AgentContext, linkSecretIds: string[]): Promise<string> {
    // Get all requested credentials and take linkSecret. If it's not the same for every credential, throw error
    const linkSecretsMatch = linkSecretIds.every((linkSecretId) => linkSecretId === linkSecretIds[0])
    if (!linkSecretsMatch) {
      throw new AnonCredsRsError('All credentials in a Proof should have been issued using the same Link Secret')
    }

    const linkSecretRecord = await agentContext.dependencyManager
      .resolve(AnonCredsLinkSecretRepository)
      .getByLinkSecretId(agentContext, linkSecretIds[0])

    if (!linkSecretRecord.value) {
      throw new AnonCredsRsError('Link Secret value not stored')
    }

    return linkSecretRecord.value
  }

  public async createProof(agentContext: AgentContext, options: CreateProofOptions): Promise<AnonCredsProof> {
    const { credentialDefinitions, proofRequest, selectedCredentials, schemas } = options

    let presentation: Presentation | undefined
    try {
      const rsCredentialDefinitions: Record<string, JsonObject> = {}
      for (const credDefId in credentialDefinitions) {
        rsCredentialDefinitions[credDefId] = credentialDefinitions[credDefId] as unknown as JsonObject
      }

      const rsSchemas: Record<string, JsonObject> = {}
      for (const schemaId in schemas) {
        rsSchemas[schemaId] = schemas[schemaId] as unknown as JsonObject
      }

      const w3cCredentialRepository = agentContext.dependencyManager.resolve(W3cCredentialRepository)
      const anoncredsCredentialRepository = agentContext.dependencyManager.resolve(AnonCredsCredentialRepository)

      // Cache retrieved credentials in order to minimize storage calls
      const retrievedCredentials = new Map<string, W3cCredentialRecord | AnonCredsCredentialRecord>()

      const credentialEntryFromAttribute = async (
        attribute: AnonCredsRequestedAttributeMatch | AnonCredsRequestedPredicateMatch
      ): Promise<{ linkSecretId: string; credentialEntry: CredentialEntry }> => {
        let credentialRecord = retrievedCredentials.get(attribute.credentialId)

        if (!credentialRecord) {
          const w3cCredentialRecord = await w3cCredentialRepository.findSingleByQuery(agentContext, {
            anonCredsCredentialId: attribute.credentialId,
          })

          if (w3cCredentialRecord) {
            credentialRecord = w3cCredentialRecord
            retrievedCredentials.set(attribute.credentialId, w3cCredentialRecord)
          } else {
            credentialRecord = await anoncredsCredentialRepository.getByCredentialId(
              agentContext,
              attribute.credentialId
            )

            agentContext.config.logger.warn(
              [
                `Creating AnonCreds proof with legacy credential ${attribute.credentialId}.`,
                `Please run the migration script to migrate credentials to the new w3c format. See https://credo.js.org/guides/updating/versions/0.4-to-0.5 for information on how to migrate.`,
              ].join('\n')
            )
          }
        }

        const { linkSecretId, revocationRegistryId, credentialRevocationId } =
          getAnoncredsCredentialInfoFromRecord(credentialRecord)

        // TODO: Check if credential has a revocation registry id (check response from anoncreds-rs API, as it is
        // sending back a mandatory string in Credential.revocationRegistryId)
        const timestamp = attribute.timestamp

        let revocationState: CredentialRevocationState | undefined
        let revocationRegistryDefinition: RevocationRegistryDefinition | undefined
        try {
          if (timestamp && credentialRevocationId && revocationRegistryId) {
            if (!options.revocationRegistries[revocationRegistryId]) {
              throw new AnonCredsRsError(`Revocation Registry ${revocationRegistryId} not found`)
            }

            const { definition, revocationStatusLists, tailsFilePath } =
              options.revocationRegistries[revocationRegistryId]

            // Extract revocation status list for the given timestamp
            const revocationStatusList = revocationStatusLists[timestamp]
            if (!revocationStatusList) {
              throw new CredoError(
                `Revocation status list for revocation registry ${revocationRegistryId} and timestamp ${timestamp} not found in revocation status lists. All revocation status lists must be present.`
              )
            }

            revocationRegistryDefinition = RevocationRegistryDefinition.fromJson(definition as unknown as JsonObject)
            revocationState = CredentialRevocationState.create({
              revocationRegistryIndex: Number(credentialRevocationId),
              revocationRegistryDefinition,
              tailsPath: tailsFilePath,
              revocationStatusList: RevocationStatusList.fromJson(revocationStatusList as unknown as JsonObject),
            })
          }

          const credential =
            credentialRecord instanceof W3cCredentialRecord
              ? this.w3cToLegacyCredential(agentContext, credentialRecord.credential as W3cJsonLdVerifiableCredential)
              : (credentialRecord.credential as AnonCredsCredential)

          return {
            linkSecretId,
            credentialEntry: {
              credential: credential as unknown as JsonObject,
              revocationState: revocationState?.toJson(),
              timestamp,
            },
          }
        } finally {
          revocationState?.handle.clear()
          revocationRegistryDefinition?.handle.clear()
        }
      }

      const credentialsProve: CredentialProve[] = []
      const credentials: { linkSecretId: string; credentialEntry: CredentialEntry }[] = []

      let entryIndex = 0
      for (const referent in selectedCredentials.attributes) {
        const attribute = selectedCredentials.attributes[referent]
        credentials.push(await credentialEntryFromAttribute(attribute))
        credentialsProve.push({ entryIndex, isPredicate: false, referent, reveal: attribute.revealed })
        entryIndex = entryIndex + 1
      }

      for (const referent in selectedCredentials.predicates) {
        const predicate = selectedCredentials.predicates[referent]
        credentials.push(await credentialEntryFromAttribute(predicate))
        credentialsProve.push({ entryIndex, isPredicate: true, referent, reveal: true })
        entryIndex = entryIndex + 1
      }

      // Get all requested credentials and take linkSecret. If it's not the same for every credential, throw error
      const linkSecretsMatch = credentials.every((item) => item.linkSecretId === credentials[0].linkSecretId)
      if (!linkSecretsMatch) {
        throw new AnonCredsRsError('All credentials in a Proof should have been issued using the same Link Secret')
      }

      const linkSecretRecord = await agentContext.dependencyManager
        .resolve(AnonCredsLinkSecretRepository)
        .getByLinkSecretId(agentContext, credentials[0].linkSecretId)

      if (!linkSecretRecord.value) {
        throw new AnonCredsRsError('Link Secret value not stored')
      }

      presentation = Presentation.create({
        credentialDefinitions: rsCredentialDefinitions,
        schemas: rsSchemas,
        presentationRequest: proofRequest as unknown as JsonObject,
        credentials: credentials.map((entry) => entry.credentialEntry),
        credentialsProve,
        selfAttest: selectedCredentials.selfAttestedAttributes,
        linkSecret: await this.getLinkSecret(
          agentContext,
          credentials.map((entry) => entry.linkSecretId)
        ),
      })

      return presentation.toJson() as unknown as AnonCredsProof
    } finally {
      presentation?.handle.clear()
    }
  }

  public async createCredentialRequest(
    agentContext: AgentContext,
    options: CreateCredentialRequestOptions
  ): Promise<CreateCredentialRequestReturn> {
    const { useLegacyProverDid, credentialDefinition, credentialOffer } = options
    let createReturnObj:
      | { credentialRequest: CredentialRequest; credentialRequestMetadata: CredentialRequestMetadata }
      | undefined
    try {
      const linkSecretRepository = agentContext.dependencyManager.resolve(AnonCredsLinkSecretRepository)

      // If a link secret is specified, use it. Otherwise, attempt to use default link secret
      let linkSecretRecord = options.linkSecretId
        ? await linkSecretRepository.getByLinkSecretId(agentContext, options.linkSecretId)
        : await linkSecretRepository.findDefault(agentContext)

      // No default link secret. Automatically create one if set on module config
      if (!linkSecretRecord) {
        const moduleConfig = agentContext.dependencyManager.resolve(AnonCredsModuleConfig)
        if (!moduleConfig.autoCreateLinkSecret) {
          throw new AnonCredsRsError(
            'No link secret provided to createCredentialRequest and no default link secret has been found'
          )
        }
        const { linkSecretId, linkSecretValue } = await this.createLinkSecret(agentContext, {})
        linkSecretRecord = await storeLinkSecret(agentContext, { linkSecretId, linkSecretValue, setAsDefault: true })
      }

      if (!linkSecretRecord.value) {
        throw new AnonCredsRsError('Link Secret value not stored')
      }

      const isLegacyIdentifier = credentialOffer.cred_def_id.match(unqualifiedCredentialDefinitionIdRegex)
      if (!isLegacyIdentifier && useLegacyProverDid) {
        throw new CredoError('Cannot use legacy prover_did with non-legacy identifiers')
      }
      createReturnObj = CredentialRequest.create({
        entropy: !useLegacyProverDid || !isLegacyIdentifier ? anoncreds.generateNonce() : undefined,
        proverDid: useLegacyProverDid
          ? TypedArrayEncoder.toBase58(TypedArrayEncoder.fromString(anoncreds.generateNonce().slice(0, 16)))
          : undefined,
        credentialDefinition: credentialDefinition as unknown as JsonObject,
        credentialOffer: credentialOffer as unknown as JsonObject,
        linkSecret: linkSecretRecord.value,
        linkSecretId: linkSecretRecord.linkSecretId,
      })

      return {
        credentialRequest: createReturnObj.credentialRequest.toJson() as unknown as AnonCredsCredentialRequest,
        credentialRequestMetadata:
          createReturnObj.credentialRequestMetadata.toJson() as unknown as AnonCredsCredentialRequestMetadata,
      }
    } finally {
      createReturnObj?.credentialRequest.handle.clear()
      createReturnObj?.credentialRequestMetadata.handle.clear()
    }
  }

  public w3cToLegacyCredential(agentContext: AgentContext, credential: W3cJsonLdVerifiableCredential) {
    const credentialJson = JsonTransformer.toJSON(credential)
    const w3cCredentialObj = W3cCredential.fromJson(credentialJson)
    const legacyCredential = w3cCredentialObj.toLegacy().toJson() as unknown as AnonCredsCredential
    return legacyCredential
  }

  public async processW3cCredential(
    agentContext: AgentContext,
    credential: W3cCredential,
    process: {
      credentialDefinition: AnonCredsCredentialDefinition
      credentialRequestMetadata: AnonCredsCredentialRequestMetadata
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition | undefined
    }
  ) {
    const { credentialRequestMetadata, revocationRegistryDefinition, credentialDefinition } = process

    const processCredentialOptions = {
      credentialRequestMetadata: credentialRequestMetadata as unknown as JsonObject,
      linkSecret: await this.getLinkSecret(agentContext, [credentialRequestMetadata.link_secret_name]),
      revocationRegistryDefinition: revocationRegistryDefinition as unknown as JsonObject,
      credentialDefinition: credentialDefinition as unknown as JsonObject,
    }

    const processedW3cCredential = credential.process(processCredentialOptions)
    return processedW3cCredential
  }

  public async legacyToW3cCredential(
    agentContext: AgentContext,
    credential: AnonCredsCredential,
    issuerId: string,
    options?: {
      credentialDefinition: AnonCredsCredentialDefinition
      credentialRequestMetadata: AnonCredsCredentialRequestMetadata
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition | undefined
    }
  ) {
    let w3cJsonLdVerifiableCredential: W3cJsonLdVerifiableCredential
    let anonCredsCredential: Credential | undefined
    let w3cCredentialObj: W3cCredential | undefined

    try {
      anonCredsCredential = Credential.fromJson(credential as unknown as JsonObject)
      w3cCredentialObj = anonCredsCredential.toW3c({
        issuerId: issuerId,
        w3cVersion: '1.1',
      })

      const jsonObject = options
        ? (await this.processW3cCredential(agentContext, w3cCredentialObj, options)).toJson()
        : w3cCredentialObj.toJson()

      w3cJsonLdVerifiableCredential = JsonTransformer.fromJSON(jsonObject, W3cJsonLdVerifiableCredential)
    } finally {
      anonCredsCredential?.handle?.clear()
      w3cCredentialObj?.handle?.clear()
    }

    return w3cJsonLdVerifiableCredential
  }

  public async storeW3cCredential(
    agentContext: AgentContext,
    options: {
      credential: W3cJsonLdVerifiableCredential
      credentialDefinitionId: string
      schema: AnonCredsSchema
      credentialDefinition: AnonCredsCredentialDefinition
      revocationRegistryDefinition?: AnonCredsRevocationRegistryDefinition
      credentialRequestMetadata: AnonCredsCredentialRequestMetadata
    }
  ) {
    const { credential, credentialRequestMetadata, schema, credentialDefinition, credentialDefinitionId } = options

    const methodName = agentContext.dependencyManager
      .resolve(AnonCredsRegistryService)
      .getRegistryForIdentifier(agentContext, credential.issuerId).methodName

    // this thows an error if the link secret is not found
    await this.getLinkSecret(agentContext, [credentialRequestMetadata.link_secret_name])

    const { revocationRegistryId, revocationRegistryIndex } = AW3cCredential.fromJson(
      JsonTransformer.toJSON(credential)
    )

    const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)
    const w3cCredentialRecord = await w3cCredentialService.storeCredential(agentContext, { credential })

    const anonCredsTags = getW3cRecordAnonCredsTags({
      w3cCredentialRecord,
      schema,
      schemaId: credentialDefinition.schemaId,
      credentialDefinitionId,
      revocationRegistryId,
      credentialRevocationId: revocationRegistryIndex?.toString(),
      linkSecretId: credentialRequestMetadata.link_secret_name,
      methodName,
    })

    const anonCredsCredentialMetadata: W3cAnoncredsCredentialMetadata = {
      credentialId: w3cCredentialRecord.id,
      credentialRevocationId: anonCredsTags.anonCredsCredentialRevocationId,
      linkSecretId: anonCredsTags.anonCredsLinkSecretId,
      methodName: anonCredsTags.anonCredsMethodName,
    }

    w3cCredentialRecord.setTags(anonCredsTags)
    w3cCredentialRecord.metadata.set(W3cAnonCredsCredentialMetadataKey, anonCredsCredentialMetadata)

    const w3cCredentialRepository = agentContext.dependencyManager.resolve(W3cCredentialRepository)
    await w3cCredentialRepository.update(agentContext, w3cCredentialRecord)

    return w3cCredentialRecord
  }

  public async storeCredential(agentContext: AgentContext, options: StoreCredentialOptions): Promise<string> {
    const {
      credential,
      credentialDefinition,
      credentialDefinitionId,
      credentialRequestMetadata,
      schema,
      revocationRegistry,
    } = options

    const w3cJsonLdCredential =
      credential instanceof W3cJsonLdVerifiableCredential
        ? credential
        : await this.legacyToW3cCredential(agentContext, credential, credentialDefinition.issuerId, {
            credentialRequestMetadata,
            credentialDefinition,
            revocationRegistryDefinition: revocationRegistry?.definition,
          })

    const w3cCredentialRecord = await this.storeW3cCredential(agentContext, {
      credentialRequestMetadata,
      credential: w3cJsonLdCredential,
      credentialDefinitionId,
      schema,
      credentialDefinition,
      revocationRegistryDefinition: revocationRegistry?.definition,
    })

    return w3cCredentialRecord.id
  }

  public async getCredential(
    agentContext: AgentContext,
    options: GetCredentialOptions
  ): Promise<AnonCredsCredentialInfo> {
    const w3cCredentialRepository = agentContext.dependencyManager.resolve(W3cCredentialRepository)
    const w3cCredentialRecord = await w3cCredentialRepository.findSingleByQuery(agentContext, {
      anonCredsCredentialId: options.credentialId,
    })
    if (w3cCredentialRecord) return getAnoncredsCredentialInfoFromRecord(w3cCredentialRecord)

    const anonCredsCredentialRepository = agentContext.dependencyManager.resolve(AnonCredsCredentialRepository)
    const anonCredsCredentialRecord = await anonCredsCredentialRepository.getByCredentialId(
      agentContext,
      options.credentialId
    )

    agentContext.config.logger.warn(
      [
        `Querying legacy credential repository for credential with id ${options.credentialId}.`,
        `Please run the migration script to migrate credentials to the new w3c format.`,
      ].join('\n')
    )

    return getAnoncredsCredentialInfoFromRecord(anonCredsCredentialRecord)
  }

  private async getLegacyCredentials(
    agentContext: AgentContext,
    options: GetCredentialsOptions
  ): Promise<AnonCredsCredentialInfo[]> {
    const credentialRecords = await agentContext.dependencyManager
      .resolve(AnonCredsCredentialRepository)
      .findByQuery(agentContext, {
        credentialDefinitionId: options.credentialDefinitionId,
        schemaId: options.schemaId,
        issuerId: options.issuerId,
        schemaName: options.schemaName,
        schemaVersion: options.schemaVersion,
        schemaIssuerId: options.schemaIssuerId,
        methodName: options.methodName,
      })

    return credentialRecords.map((credentialRecord) => getAnoncredsCredentialInfoFromRecord(credentialRecord))
  }

  public async getCredentials(
    agentContext: AgentContext,
    options: GetCredentialsOptions
  ): Promise<AnonCredsCredentialInfo[]> {
    const credentialRecords = await agentContext.dependencyManager
      .resolve(W3cCredentialRepository)
      .findByQuery(agentContext, {
        anonCredsCredentialDefinitionId:
          !options.credentialDefinitionId || isUnqualifiedCredentialDefinitionId(options.credentialDefinitionId)
            ? undefined
            : options.credentialDefinitionId,
        anonCredsSchemaId: !options.schemaId || isUnqualifiedSchemaId(options.schemaId) ? undefined : options.schemaId,
        anonCredsIssuerId: !options.issuerId || isUnqualifiedIndyDid(options.issuerId) ? undefined : options.issuerId,
        anonCredsSchemaName: options.schemaName,
        anonCredsSchemaVersion: options.schemaVersion,
        anonCredsSchemaIssuerId:
          !options.schemaIssuerId || isUnqualifiedIndyDid(options.schemaIssuerId) ? undefined : options.schemaIssuerId,

        anonCredsMethodName: options.methodName,
        anonCredsUnqualifiedSchemaId:
          options.schemaId && isUnqualifiedSchemaId(options.schemaId) ? options.schemaId : undefined,
        anonCredsUnqualifiedIssuerId:
          options.issuerId && isUnqualifiedIndyDid(options.issuerId) ? options.issuerId : undefined,
        anonCredsUnqualifiedSchemaIssuerId:
          options.schemaIssuerId && isUnqualifiedIndyDid(options.schemaIssuerId) ? options.schemaIssuerId : undefined,
        anonCredsUnqualifiedCredentialDefinitionId:
          options.credentialDefinitionId && isUnqualifiedCredentialDefinitionId(options.credentialDefinitionId)
            ? options.credentialDefinitionId
            : undefined,
      })

    const credentials = credentialRecords.map((credentialRecord) =>
      getAnoncredsCredentialInfoFromRecord(credentialRecord)
    )
    const legacyCredentials = await this.getLegacyCredentials(agentContext, options)

    if (legacyCredentials.length > 0) {
      agentContext.config.logger.warn(
        `Queried credentials include legacy credentials. Please run the migration script to migrate credentials to the new w3c format.`
      )
    }
    return [...legacyCredentials, ...credentials]
  }

  public async deleteCredential(agentContext: AgentContext, credentialId: string): Promise<void> {
    const w3cCredentialRepository = agentContext.dependencyManager.resolve(W3cCredentialRepository)
    const w3cCredentialRecord = await w3cCredentialRepository.findSingleByQuery(agentContext, {
      anonCredsCredentialId: credentialId,
    })

    if (w3cCredentialRecord) {
      await w3cCredentialRepository.delete(agentContext, w3cCredentialRecord)
      return
    }

    const anoncredsCredentialRepository = agentContext.dependencyManager.resolve(AnonCredsCredentialRepository)
    const anoncredsCredentialRecord = await anoncredsCredentialRepository.getByCredentialId(agentContext, credentialId)
    await anoncredsCredentialRepository.delete(agentContext, anoncredsCredentialRecord)
  }
  private async getLegacyCredentialsForProofRequest(
    agentContext: AgentContext,
    options: GetCredentialsForProofRequestOptions
  ): Promise<GetCredentialsForProofRequestReturn> {
    const proofRequest = options.proofRequest
    const referent = options.attributeReferent

    const requestedAttribute =
      proofRequest.requested_attributes[referent] ?? proofRequest.requested_predicates[referent]

    if (!requestedAttribute) {
      throw new AnonCredsRsError(`Referent not found in proof request`)
    }

    const $and = []

    // Make sure the attribute(s) that are requested are present using the marker tag
    const attributes = requestedAttribute.names ?? [requestedAttribute.name]
    const attributeQuery: SimpleQuery<AnonCredsCredentialRecord> = {}
    for (const attribute of attributes) {
      attributeQuery[`anonCredsAttr::${attribute}::marker`] = true
    }
    $and.push(attributeQuery)

    // Add query for proof request restrictions
    if (requestedAttribute.restrictions) {
      const restrictionQuery = this.queryLegacyFromRestrictions(requestedAttribute.restrictions)
      $and.push(restrictionQuery)
    }

    // Add extra query
    // TODO: we're not really typing the extraQuery, and it will work differently based on the anoncreds implmentation
    // We should make the allowed properties more strict
    if (options.extraQuery) {
      $and.push(options.extraQuery)
    }

    const credentials = await agentContext.dependencyManager
      .resolve(AnonCredsCredentialRepository)
      .findByQuery(agentContext, {
        $and,
      })

    return credentials.map((credentialRecord) => {
      return {
        credentialInfo: getAnoncredsCredentialInfoFromRecord(credentialRecord),
        interval: proofRequest.non_revoked,
      }
    })
  }

  public async getCredentialsForProofRequest(
    agentContext: AgentContext,
    options: GetCredentialsForProofRequestOptions
  ): Promise<GetCredentialsForProofRequestReturn> {
    const proofRequest = options.proofRequest
    const referent = options.attributeReferent

    const requestedAttribute =
      proofRequest.requested_attributes[referent] ?? proofRequest.requested_predicates[referent]

    if (!requestedAttribute) {
      throw new AnonCredsRsError(`Referent not found in proof request`)
    }

    const $and = []

    // Make sure the attribute(s) that are requested are present using the marker tag
    const attributes = requestedAttribute.names ?? [requestedAttribute.name]
    const attributeQuery: SimpleQuery<W3cCredentialRecord> = {}
    for (const attribute of attributes) {
      attributeQuery[`anonCredsAttr::${attribute}::marker`] = true
    }
    $and.push(attributeQuery)

    // Add query for proof request restrictions
    if (requestedAttribute.restrictions) {
      const restrictionQuery = this.queryFromRestrictions(requestedAttribute.restrictions)
      $and.push(restrictionQuery)
    }

    // Add extra query
    // TODO: we're not really typing the extraQuery, and it will work differently based on the anoncreds implmentation
    // We should make the allowed properties more strict
    if (options.extraQuery) {
      $and.push(options.extraQuery)
    }

    const w3cCredentialRepository = agentContext.dependencyManager.resolve(W3cCredentialRepository)
    const credentials = await w3cCredentialRepository.findByQuery(agentContext, { $and })
    const legacyCredentialWithMetadata = await this.getLegacyCredentialsForProofRequest(agentContext, options)

    if (legacyCredentialWithMetadata.length > 0) {
      agentContext.config.logger.warn(
        [
          `Including legacy credentials in proof request.`,
          `Please run the migration script to migrate credentials to the new w3c format.`,
        ].join('\n')
      )
    }

    const credentialWithMetadata = credentials.map((credentialRecord) => {
      return {
        credentialInfo: getAnoncredsCredentialInfoFromRecord(credentialRecord),
        interval: proofRequest.non_revoked,
      }
    })

    return [...credentialWithMetadata, ...legacyCredentialWithMetadata]
  }

  private queryFromRestrictions(restrictions: AnonCredsProofRequestRestriction[]) {
    const query: Query<W3cCredentialRecord>[] = []

    const { restrictions: parsedRestrictions } = JsonTransformer.fromJSON({ restrictions }, AnonCredsRestrictionWrapper)

    for (const restriction of parsedRestrictions) {
      const queryElements: SimpleQuery<W3cCredentialRecord> = {}

      if (restriction.credentialDefinitionId) {
        if (isUnqualifiedCredentialDefinitionId(restriction.credentialDefinitionId)) {
          queryElements.anonCredsUnqualifiedCredentialDefinitionId = restriction.credentialDefinitionId
        } else {
          queryElements.anonCredsCredentialDefinitionId = restriction.credentialDefinitionId
        }
      }

      if (restriction.issuerId || restriction.issuerDid) {
        const issuerId = (restriction.issuerId ?? restriction.issuerDid) as string
        if (isUnqualifiedIndyDid(issuerId)) {
          queryElements.anonCredsUnqualifiedIssuerId = issuerId
        } else {
          queryElements.anonCredsIssuerId = issuerId
        }
      }

      if (restriction.schemaId) {
        if (isUnqualifiedSchemaId(restriction.schemaId)) {
          queryElements.anonCredsUnqualifiedSchemaId = restriction.schemaId
        } else {
          queryElements.anonCredsSchemaId = restriction.schemaId
        }
      }

      if (restriction.schemaIssuerId || restriction.schemaIssuerDid) {
        const schemaIssuerId = (restriction.schemaIssuerId ?? restriction.schemaIssuerDid) as string
        if (isUnqualifiedIndyDid(schemaIssuerId)) {
          queryElements.anonCredsUnqualifiedSchemaIssuerId = schemaIssuerId
        } else {
          queryElements.anonCredsSchemaIssuerId = schemaIssuerId
        }
      }

      if (restriction.schemaName) {
        queryElements.anonCredsSchemaName = restriction.schemaName
      }

      if (restriction.schemaVersion) {
        queryElements.anonCredsSchemaVersion = restriction.schemaVersion
      }

      for (const [attributeName, attributeValue] of Object.entries(restriction.attributeValues)) {
        queryElements[`anonCredsAttr::${attributeName}::value`] = attributeValue
      }

      for (const [attributeName, isAvailable] of Object.entries(restriction.attributeMarkers)) {
        if (isAvailable) {
          queryElements[`anonCredsAttr::${attributeName}::marker`] = isAvailable
        }
      }

      query.push(queryElements)
    }

    return query.length === 1 ? query[0] : { $or: query }
  }

  private queryLegacyFromRestrictions(restrictions: AnonCredsProofRequestRestriction[]) {
    const query: Query<AnonCredsCredentialRecord>[] = []

    const { restrictions: parsedRestrictions } = JsonTransformer.fromJSON({ restrictions }, AnonCredsRestrictionWrapper)

    for (const restriction of parsedRestrictions) {
      const queryElements: SimpleQuery<AnonCredsCredentialRecord> = {}
      const additionalQueryElements: SimpleQuery<AnonCredsCredentialRecord> = {}

      if (restriction.credentialDefinitionId) {
        queryElements.credentialDefinitionId = restriction.credentialDefinitionId
        if (isUnqualifiedCredentialDefinitionId(restriction.credentialDefinitionId)) {
          additionalQueryElements.credentialDefinitionId = restriction.credentialDefinitionId
        }
      }

      if (restriction.issuerId || restriction.issuerDid) {
        const issuerId = (restriction.issuerId ?? restriction.issuerDid) as string
        queryElements.issuerId = issuerId
        if (isUnqualifiedIndyDid(issuerId)) {
          additionalQueryElements.issuerId = issuerId
        }
      }

      if (restriction.schemaId) {
        queryElements.schemaId = restriction.schemaId
        if (isUnqualifiedSchemaId(restriction.schemaId)) {
          additionalQueryElements.schemaId = restriction.schemaId
        }
      }

      if (restriction.schemaIssuerId || restriction.schemaIssuerDid) {
        const issuerId = (restriction.schemaIssuerId ?? restriction.schemaIssuerDid) as string
        queryElements.schemaIssuerId = issuerId
        if (isUnqualifiedIndyDid(issuerId)) {
          additionalQueryElements.schemaIssuerId = issuerId
        }
      }

      if (restriction.schemaName) {
        queryElements.schemaName = restriction.schemaName
      }

      if (restriction.schemaVersion) {
        queryElements.schemaVersion = restriction.schemaVersion
      }

      for (const [attributeName, attributeValue] of Object.entries(restriction.attributeValues)) {
        queryElements[`attr::${attributeName}::value`] = attributeValue
      }

      for (const [attributeName, isAvailable] of Object.entries(restriction.attributeMarkers)) {
        if (isAvailable) {
          queryElements[`attr::${attributeName}::marker`] = isAvailable
        }
      }

      query.push(queryElements)
      if (Object.keys(additionalQueryElements).length > 0) {
        query.push(additionalQueryElements)
      }
    }

    return query.length === 1 ? query[0] : { $or: query }
  }

  public async createW3cPresentation(options: CreateW3cPresentationOptions) {
    let presentation: W3cPresentation | undefined
    try {
      presentation = W3cPresentation.create(options)
      const presentationJson = presentation.toJson() as unknown as JsonObject
      return presentationJson
    } finally {
      presentation?.handle.clear()
    }
  }
}
