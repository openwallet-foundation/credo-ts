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
import type { AgentContext, AnonCredsClaimRecord, Query, SimpleQuery } from '@credo-ts/core'
import type {
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
  isDid,
  utils,
} from '@credo-ts/core'
import {
  W3cCredential as AW3cCredential,
  CredentialRequest,
  CredentialRevocationState,
  LinkSecret,
  Presentation,
  RevocationRegistryDefinition,
  RevocationStatusList,
  anoncreds,
} from '@hyperledger/anoncreds-shared'

import { AnonCredsModuleConfig } from '../AnonCredsModuleConfig'
import { AnonCredsRsError } from '../error'
import {
  type AnonCredsCredentialDefinition,
  type AnonCredsProof,
  type AnonCredsRequestedAttributeMatch,
  type AnonCredsRequestedPredicateMatch,
  type AnonCredsRevocationRegistryDefinition,
  type AnonCredsSchema,
  type AnonCredsCredentialRequest,
  type AnonCredsCredentialRequestMetadata,
  type AnonCredsCredential,
  type AnonCredsCredentialInfo,
  type AnonCredsProofRequestRestriction,
  AnonCredsRestrictionWrapper,
} from '../models'
import { AnonCredsCredentialRecord, AnonCredsCredentialRepository, AnonCredsLinkSecretRepository } from '../repository'
import { AnonCredsRegistryService } from '../services'
import {
  fetchCredentialDefinition,
  legacyCredentialToW3cCredential,
  storeLinkSecret,
  unqualifiedCredentialDefinitionIdRegex,
  w3cToLegacyCredential,
  getQualifiedCredentialDefinition,
  getIndyNamespace,
  getQualifiedRevocationRegistryDefinition,
  getQualifiedSchema,
  isIndyDid,
  getNonQualifiedId,
} from '../utils'

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

      const credentialRepository = agentContext.dependencyManager.resolve(W3cCredentialRepository)
      const legacyCredentialRepository = agentContext.dependencyManager.resolve(AnonCredsCredentialRepository)

      // Cache retrieved credentials in order to minimize storage calls
      const retrievedCredentials = new Map<string, W3cCredentialRecord | AnonCredsCredentialRecord>()

      const credentialEntryFromAttribute = async (
        attribute: AnonCredsRequestedAttributeMatch | AnonCredsRequestedPredicateMatch
      ): Promise<{ linkSecretId: string; credentialEntry: CredentialEntry }> => {
        let credentialRecord = retrievedCredentials.get(attribute.credentialId)
        if (!credentialRecord) {
          try {
            credentialRecord = await credentialRepository.getByCredentialId(agentContext, attribute.credentialId)
            retrievedCredentials.set(attribute.credentialId, credentialRecord)
          } catch {
            // do nothing
          }

          if (!credentialRecord) {
            credentialRecord = await legacyCredentialRepository.getByCredentialId(agentContext, attribute.credentialId)

            agentContext.config.logger.warn(
              [
                `Creating proof with legacy credential ${attribute.credentialId}.`,
                `Please run the migration script to migrate credentials to the new w3c format.`,
              ].join('\n')
            )
          }
        }

        let revocationRegistryId: string | null
        let credentialRevocationId: string | null
        let linkSecretId: string

        if (credentialRecord instanceof W3cCredentialRecord) {
          if (!credentialRecord.anonCredsCredentialMetadata) {
            throw new CredoError('AnonCreds metadata not found on credential record.')
          }

          if (credentialRecord.credential instanceof W3cJsonLdVerifiableCredential === false) {
            throw new CredoError('Credential must be a W3cJsonLdVerifiableCredential.')
          }

          linkSecretId = credentialRecord.anonCredsCredentialMetadata.linkSecretId
          const metadata = this.anoncredsMetadataFromRecord(credentialRecord)
          revocationRegistryId = metadata.revocationRegistryId
          credentialRevocationId = metadata.credentialRevocationId
        } else if (credentialRecord instanceof AnonCredsCredentialRecord) {
          const metadata = this.anoncredsMetadataFromLegacyRecord(credentialRecord)
          linkSecretId = credentialRecord.linkSecretId
          revocationRegistryId = metadata.revocationRegistryId
          credentialRevocationId = metadata.credentialRevocationId
        } else {
          throw new CredoError('Credential record must be either a W3cCredentialRecord or AnonCredsCredentialRecord.')
        }

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
              ? w3cToLegacyCredential(credentialRecord.credential as W3cJsonLdVerifiableCredential)
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
        linkSecret: linkSecretRecord.value,
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

  public async legacyToW3cCredential(
    agentContext: AgentContext,
    options: {
      credential: AnonCredsCredential
      credentialDefinition: AnonCredsCredentialDefinition
      credentialRequestMetadata: AnonCredsCredentialRequestMetadata
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition | undefined
    }
  ) {
    const { credential, credentialRequestMetadata, revocationRegistryDefinition, credentialDefinition } = options

    const linkSecretRecord = await agentContext.dependencyManager
      .resolve(AnonCredsLinkSecretRepository)
      .getByLinkSecretId(agentContext, credentialRequestMetadata.link_secret_name)

    if (!linkSecretRecord.value) {
      throw new AnonCredsRsError('Link Secret value not stored')
    }

    const w3cJsonLdCredential = await legacyCredentialToW3cCredential(credential, credentialDefinition, {
      credentialRequestMetadata: credentialRequestMetadata as unknown as JsonObject,
      linkSecret: linkSecretRecord.value,
      revocationRegistryDefinition: revocationRegistryDefinition as unknown as JsonObject,
    })

    return w3cJsonLdCredential
  }

  public async storeW3cCredential(
    agentContext: AgentContext,
    options: {
      credentialId?: string
      credential: W3cJsonLdVerifiableCredential
      credentialDefinitionId: string
      schema: AnonCredsSchema
      credentialDefinition: AnonCredsCredentialDefinition
      revocationRegistryDefinition?: AnonCredsRevocationRegistryDefinition
      credentialRequestMetadata: AnonCredsCredentialRequestMetadata
    }
  ): Promise<string> {
    const { credential, credentialRequestMetadata, schema, credentialDefinition, credentialDefinitionId } = options

    const methodName = agentContext.dependencyManager
      .resolve(AnonCredsRegistryService)
      .getRegistryForIdentifier(agentContext, credential.issuerId).methodName

    const linkSecretRecord = await agentContext.dependencyManager
      .resolve(AnonCredsLinkSecretRepository)
      .getByLinkSecretId(agentContext, credentialRequestMetadata.link_secret_name)

    if (!linkSecretRecord.value) {
      throw new AnonCredsRsError('Link Secret value not stored')
    }

    const { revocationRegistryId, revocationRegistryIndex } = AW3cCredential.fromJson(
      JsonTransformer.toJSON(credential)
    )

    const credentialId = options.credentialId ?? utils.uuid()

    const indyDid = isIndyDid(credential.issuerId)

    const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)
    await w3cCredentialService.storeCredential(agentContext, {
      credential,
      anonCredsCredentialRecordOptions: {
        credentialId,
        linkSecretId: linkSecretRecord.linkSecretId,
        credentialDefinitionId,
        schemaId: credentialDefinition.schemaId,
        schemaName: schema.name,
        schemaIssuerId: schema.issuerId,
        schemaVersion: schema.version,
        methodName,
        revocationRegistryId,
        credentialRevocationId: revocationRegistryIndex?.toString(),
        unqualifiedTags: indyDid
          ? {
              issuerId: getNonQualifiedId(credential.issuerId),
              credentialDefinitionId: getNonQualifiedId(credentialDefinitionId),
              schemaId: getNonQualifiedId(credentialDefinition.schemaId),
              schemaIssuerId: getNonQualifiedId(schema.issuerId),
              revocationRegistryId: revocationRegistryId ? getNonQualifiedId(revocationRegistryId) : undefined,
            }
          : undefined,
      },
    })

    return credentialId
  }

  // convert legacy to w3c and call store w3c
  public async storeCredential(agentContext: AgentContext, options: StoreCredentialOptions): Promise<string> {
    const {
      credentialId,
      credential,
      credentialDefinition,
      credentialDefinitionId,
      credentialRequestMetadata,
      schema,
      revocationRegistry,
    } = options

    const qualifiedCredentialDefinitionId = isDid(credentialDefinitionId)
      ? credentialDefinitionId
      : (await fetchCredentialDefinition(agentContext, credentialDefinitionId)).qualifiedId

    const qualifiedSchema = getQualifiedSchema(schema, getIndyNamespace(qualifiedCredentialDefinitionId))

    const qualifiedCredentialDefinition = getQualifiedCredentialDefinition(
      credentialDefinition,
      getIndyNamespace(qualifiedCredentialDefinitionId)
    )

    const qualifiedRevocationRegistryDefinition = !revocationRegistry?.definition
      ? undefined
      : getQualifiedRevocationRegistryDefinition(
          revocationRegistry.definition,
          getIndyNamespace(qualifiedCredentialDefinitionId)
        )

    const w3cJsonLdCredential =
      credential instanceof W3cJsonLdVerifiableCredential
        ? credential
        : await this.legacyToW3cCredential(agentContext, {
            credential,
            credentialRequestMetadata,
            credentialDefinition: qualifiedCredentialDefinition,
            revocationRegistryDefinition: qualifiedRevocationRegistryDefinition,
          })

    return await this.storeW3cCredential(agentContext, {
      credentialId,
      credentialRequestMetadata,
      credential: w3cJsonLdCredential,
      credentialDefinitionId: qualifiedCredentialDefinitionId,
      schema: qualifiedSchema,
      credentialDefinition: qualifiedCredentialDefinition,
      revocationRegistryDefinition: qualifiedRevocationRegistryDefinition,
    })
  }

  public async getCredential(
    agentContext: AgentContext,
    options: GetCredentialOptions
  ): Promise<AnonCredsCredentialInfo> {
    try {
      const credentialRepository = agentContext.dependencyManager.resolve(W3cCredentialRepository)
      const credentialRecord = await credentialRepository.getByCredentialId(agentContext, options.credentialId)
      if (credentialRecord) return this.anoncredsMetadataFromRecord(credentialRecord)
    } catch {
      // do nothing
    }

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

    return this.anoncredsMetadataFromLegacyRecord(anonCredsCredentialRecord)
  }

  private anoncredsMetadataFromLegacyRecord(
    anonCredsCredentialRecord: AnonCredsCredentialRecord
  ): AnonCredsCredentialInfo {
    const attributes: { [key: string]: string } = {}
    for (const attribute in anonCredsCredentialRecord.credential) {
      attributes[attribute] = anonCredsCredentialRecord.credential.values[attribute].raw
    }

    return {
      attributes,
      credentialDefinitionId: anonCredsCredentialRecord.credential.cred_def_id,
      credentialId: anonCredsCredentialRecord.credentialId,
      schemaId: anonCredsCredentialRecord.credential.schema_id,
      credentialRevocationId: anonCredsCredentialRecord.credentialRevocationId ?? null,
      revocationRegistryId: anonCredsCredentialRecord.credential.rev_reg_id ?? null,
      methodName: anonCredsCredentialRecord.methodName,
    }
  }

  private anoncredsMetadataFromRecord(w3cCredentialRecord: W3cCredentialRecord): AnonCredsCredentialInfo {
    if (Array.isArray(w3cCredentialRecord.credential.credentialSubject)) {
      throw new CredoError('Credential subject must be an object, not an array.')
    }

    const anonCredsTags = w3cCredentialRecord.getAnonCredsTags()
    if (!anonCredsTags) throw new CredoError('AnonCreds tags not found on credential record.')

    const anoncredsCredentialMetadata = w3cCredentialRecord.anonCredsCredentialMetadata
    if (!anoncredsCredentialMetadata) throw new CredoError('AnonCreds metadata not found on credential record.')

    return {
      attributes: (w3cCredentialRecord.credential.credentialSubject.claims as AnonCredsClaimRecord) ?? {},
      credentialId: anoncredsCredentialMetadata.credentialId,
      credentialDefinitionId: anonCredsTags.credentialDefinitionId,
      schemaId: anonCredsTags.schemaId,
      credentialRevocationId: anoncredsCredentialMetadata.credentialRevocationId ?? null,
      revocationRegistryId: anonCredsTags.revocationRegistryId ?? null,
      methodName: anoncredsCredentialMetadata.methodName,
    }
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

    return credentialRecords.map((credentialRecord) => this.anoncredsMetadataFromLegacyRecord(credentialRecord))
  }

  public async getCredentials(
    agentContext: AgentContext,
    options: GetCredentialsOptions
  ): Promise<AnonCredsCredentialInfo[]> {
    const getIfQualifiedId = (id: string | undefined) => {
      return !id ? undefined : isDid(id) ? id : undefined
    }

    const getIfUnqualifiedId = (id: string | undefined) => {
      return !id ? undefined : isDid(id) ? undefined : id
    }

    const credentialRecords = await agentContext.dependencyManager
      .resolve(W3cCredentialRepository)
      .findByQuery(agentContext, {
        credentialDefinitionId: getIfQualifiedId(options.credentialDefinitionId),
        schemaId: getIfQualifiedId(options.schemaId),
        issuerId: getIfQualifiedId(options.issuerId),
        schemaName: options.schemaName,
        schemaVersion: options.schemaVersion,
        schemaIssuerId: getIfQualifiedId(options.schemaIssuerId),
        methodName: options.methodName,
        unqualifiedSchemaId: getIfUnqualifiedId(options.schemaId),
        unqualifiedIssuerId: getIfUnqualifiedId(options.issuerId),
        unqualifiedSchemaIssuerId: getIfUnqualifiedId(options.schemaIssuerId),
        unqualifiedCredentialDefinitionId: getIfUnqualifiedId(options.credentialDefinitionId),
      })

    const credentials = credentialRecords.map((credentialRecord) => this.anoncredsMetadataFromRecord(credentialRecord))
    const legacyCredentials = await this.getLegacyCredentials(agentContext, options)

    if (legacyCredentials.length > 0) {
      agentContext.config.logger.warn(
        [
          `Queried credentials include legacy credentials.`,
          `Please run the migration script to migrate credentials to the new w3c format.`,
        ].join('\n')
      )
    }
    return [...legacyCredentials, ...credentials]
  }

  public async deleteCredential(agentContext: AgentContext, credentialId: string): Promise<void> {
    try {
      const credentialRepository = agentContext.dependencyManager.resolve(W3cCredentialRepository)
      const credentialRecord = await credentialRepository.getByCredentialId(agentContext, credentialId)
      await credentialRepository.delete(agentContext, credentialRecord)
      return
    } catch {
      // do nothing
    }

    const credentialRepository = agentContext.dependencyManager.resolve(AnonCredsCredentialRepository)
    const credentialRecord = await credentialRepository.getByCredentialId(agentContext, credentialId)
    await credentialRepository.delete(agentContext, credentialRecord)
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
      attributeQuery[`attr::${attribute}::marker`] = true
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
        credentialInfo: this.anoncredsMetadataFromLegacyRecord(credentialRecord),
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
      attributeQuery[`attr::${attribute}::marker`] = true
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

    const credentials = await agentContext.dependencyManager
      .resolve(W3cCredentialRepository)
      .findByQuery(agentContext, {
        $and,
      })

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
        credentialInfo: this.anoncredsMetadataFromRecord(credentialRecord),
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
        if (isDid(restriction.credentialDefinitionId)) {
          queryElements.credentialDefinitionId = restriction.credentialDefinitionId
        } else {
          queryElements.unqualifiedCredentialDefinitionId = restriction.credentialDefinitionId
        }
      }

      if (restriction.issuerId || restriction.issuerDid) {
        const issuerId = (restriction.issuerId ?? restriction.issuerDid) as string
        if (isDid(issuerId)) {
          queryElements.issuerId = issuerId
        } else {
          queryElements.unqualifiedIssuerId = issuerId
        }
      }

      if (restriction.schemaId) {
        if (isDid(restriction.schemaId)) {
          queryElements.schemaId = restriction.schemaId
        } else {
          queryElements.unqualifiedSchemaId = restriction.schemaId
        }
      }

      if (restriction.schemaIssuerId || restriction.schemaIssuerDid) {
        const issuerId = (restriction.schemaIssuerId ?? restriction.schemaIssuerDid) as string
        if (isDid(issuerId)) {
          queryElements.schemaIssuerId = issuerId
        } else {
          queryElements.unqualifiedSchemaIssuerId = issuerId
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
    }

    return query.length === 1 ? query[0] : { $or: query }
  }

  private queryLegacyFromRestrictions(restrictions: AnonCredsProofRequestRestriction[]) {
    const query: Query<AnonCredsCredentialRecord>[] = []

    const { restrictions: parsedRestrictions } = JsonTransformer.fromJSON({ restrictions }, AnonCredsRestrictionWrapper)

    for (const restriction of parsedRestrictions) {
      const queryElements: SimpleQuery<AnonCredsCredentialRecord> = {}

      if (restriction.credentialDefinitionId) {
        queryElements.credentialDefinitionId = restriction.credentialDefinitionId
      }

      if (restriction.issuerId || restriction.issuerDid) {
        queryElements.issuerId = restriction.issuerId ?? restriction.issuerDid
      }

      if (restriction.schemaId) {
        queryElements.schemaId = restriction.schemaId
      }

      if (restriction.schemaIssuerId || restriction.schemaIssuerDid) {
        queryElements.schemaIssuerId = restriction.schemaIssuerId ?? restriction.issuerDid
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
    }

    return query.length === 1 ? query[0] : { $or: query }
  }
}
