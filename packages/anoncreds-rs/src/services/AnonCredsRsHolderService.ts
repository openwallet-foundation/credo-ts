import type {
  AnonCredsCredentialInfo,
  AnonCredsCredentialRequest,
  AnonCredsCredentialRequestMetadata,
  AnonCredsHolderService,
  AnonCredsProof,
  AnonCredsProofRequestRestriction,
  AnonCredsRequestedAttributeMatch,
  AnonCredsRequestedPredicateMatch,
  CreateCredentialRequestOptions,
  CreateCredentialRequestReturn,
  CreateLinkSecretOptions,
  CreateLinkSecretReturn,
  CreateProofOptions,
  GetCredentialOptions,
  GetCredentialsForProofRequestOptions,
  GetCredentialsForProofRequestReturn,
  GetCredentialsOptions,
  StoreCredentialOptions,
  StoreW3cCredentialOptions,
} from '@aries-framework/anoncreds'
import type { AgentContext, AnonCredsClaimRecord, Query, SimpleQuery, W3cCredentialRecord } from '@aries-framework/core'
import type {
  CredentialEntry,
  CredentialProve,
  CredentialRequestMetadata,
  JsonObject,
} from '@hyperledger/anoncreds-shared'

import {
  AnonCredsLinkSecretRepository,
  AnonCredsRegistryService,
  AnonCredsRestrictionWrapper,
  fetchQualifiedIds,
  legacyCredentialToW3cCredential,
  storeLinkSecret,
  unqualifiedCredentialDefinitionIdRegex,
  w3cToLegacyCredential,
} from '@aries-framework/anoncreds'
import {
  AriesFrameworkError,
  JsonTransformer,
  TypedArrayEncoder,
  W3cCredentialRepository,
  W3cCredentialService,
  W3cJsonLdVerifiableCredential,
  injectable,
  utils,
} from '@aries-framework/core'
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

import { AnonCredsRsModuleConfig } from '../AnonCredsRsModuleConfig'
import { AnonCredsRsError } from '../errors/AnonCredsRsError'

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

      // Cache retrieved credentials in order to minimize storage calls
      const retrievedCredentials = new Map<string, W3cCredentialRecord>()

      const credentialEntryFromAttribute = async (
        attribute: AnonCredsRequestedAttributeMatch | AnonCredsRequestedPredicateMatch
      ): Promise<{ linkSecretId: string; credentialEntry: CredentialEntry }> => {
        let credentialRecord = retrievedCredentials.get(attribute.credentialId)
        if (!credentialRecord) {
          credentialRecord = await credentialRepository.getByCredentialId(agentContext, attribute.credentialId)
          retrievedCredentials.set(attribute.credentialId, credentialRecord)
        }

        if (!credentialRecord.anonCredsCredentialMetadata) {
          throw new AriesFrameworkError('AnonCreds metadata not found on credential record.')
        }

        if (credentialRecord.credential instanceof W3cJsonLdVerifiableCredential === false) {
          throw new AriesFrameworkError('Credential must be a W3cJsonLdVerifiableCredential.')
        }

        const { revocationRegistryId, credentialRevocationId } = this.anoncredsMetadataFromRecord(credentialRecord)

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
              throw new AriesFrameworkError(
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

          return {
            linkSecretId: credentialRecord.anonCredsCredentialMetadata.linkSecretId,
            credentialEntry: {
              credential: w3cToLegacyCredential(
                credentialRecord.credential as W3cJsonLdVerifiableCredential
              ) as unknown as JsonObject,
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
        const moduleConfig = agentContext.dependencyManager.resolve(AnonCredsRsModuleConfig)
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
        throw new AriesFrameworkError('Cannot use legacy prover_did with non-legacy identifiers')
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

  public async legacyToW3cCredential(agentContext: AgentContext, options: StoreCredentialOptions) {
    const { credential, credentialDefinition, credentialRequestMetadata, revocationRegistry } = options

    const linkSecretRecord = await agentContext.dependencyManager
      .resolve(AnonCredsLinkSecretRepository)
      .getByLinkSecretId(agentContext, credentialRequestMetadata.link_secret_name)

    if (!linkSecretRecord.value) {
      throw new AnonCredsRsError('Link Secret value not stored')
    }

    const w3cJsonLdCredential = await legacyCredentialToW3cCredential(agentContext, credential, {
      credentialDefinition: credentialDefinition as unknown as JsonObject,
      credentialRequestMetadata: credentialRequestMetadata as unknown as JsonObject,
      linkSecret: linkSecretRecord.value,
      revocationRegistryDefinition: revocationRegistry?.definition as unknown as JsonObject,
    })

    return w3cJsonLdCredential
  }

  public async storeW3cCredential(agentContext: AgentContext, options: StoreW3cCredentialOptions): Promise<string> {
    const {
      credential,
      credentialRequestMetadata,
      schema,
      revocationRegistry,
      credentialDefinition,
      credentialDefinitionId: credDefId,
    } = options

    const methodName = agentContext.dependencyManager
      .resolve(AnonCredsRegistryService)
      .getRegistryForIdentifier(agentContext, credDefId).methodName

    const linkSecretRecord = await agentContext.dependencyManager
      .resolve(AnonCredsLinkSecretRepository)
      .getByLinkSecretId(agentContext, credentialRequestMetadata.link_secret_name)

    if (!linkSecretRecord.value) {
      throw new AnonCredsRsError('Link Secret value not stored')
    }

    const { schemaId, schemaIssuerId, revocationRegistryId, credentialDefinitionId } = await fetchQualifiedIds(
      agentContext,
      {
        schemaId: credentialDefinition.schemaId,
        schemaIssuerId: schema.issuerId,
        revocationRegistryId: revocationRegistry?.id,
        credentialDefinitionId: credDefId,
      }
    )

    const credentialRevocationId = AW3cCredential.fromJson(JsonTransformer.toJSON(credential)).revocationRegistryIndex

    const credentialId = options.credentialId ?? utils.uuid()

    const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)
    await w3cCredentialService.storeCredential(agentContext, {
      credential,
      anonCredsCredentialRecordOptions: {
        credentialId,
        linkSecretId: linkSecretRecord.linkSecretId,
        credentialDefinitionId,
        schemaId,
        schemaName: schema.name,
        schemaIssuerId,
        schemaVersion: schema.version,
        methodName,
        revocationRegistryId: revocationRegistryId,
        credentialRevocationId: credentialRevocationId?.toString(),
      },
    })

    return credentialId
  }

  // convert legacy to w3c and call store w3c
  public async storeCredential(agentContext: AgentContext, options: StoreCredentialOptions): Promise<string> {
    const w3cJsonLdCredential = await this.legacyToW3cCredential(agentContext, options)

    return await this.storeW3cCredential(agentContext, {
      ...options,
      credential: w3cJsonLdCredential,
    })
  }

  public async getCredential(
    agentContext: AgentContext,
    options: GetCredentialOptions
  ): Promise<AnonCredsCredentialInfo> {
    const credentialRepository = agentContext.dependencyManager.resolve(W3cCredentialRepository)
    const credentialRecord = await credentialRepository.getByCredentialId(agentContext, options.credentialId)

    return this.anoncredsMetadataFromRecord(credentialRecord)
  }

  private anoncredsMetadataFromRecord(w3cCredentialRecord: W3cCredentialRecord): AnonCredsCredentialInfo {
    if (Array.isArray(w3cCredentialRecord.credential.credentialSubject))
      throw new AriesFrameworkError('Credential subject must be an object, not an array.')

    const anonCredsTags = w3cCredentialRecord.getAnonCredsTags()
    if (!anonCredsTags) throw new AriesFrameworkError('AnonCreds tags not found on credential record.')

    const anoncredsCredentialMetadata = w3cCredentialRecord.anonCredsCredentialMetadata
    if (!anoncredsCredentialMetadata)
      throw new AriesFrameworkError('AnonCreds metadata not found on credential record.')

    return {
      attributes: (w3cCredentialRecord.credential.credentialSubject.claims as AnonCredsClaimRecord) ?? {},
      credentialId: anoncredsCredentialMetadata.credentialId,
      credentialDefinitionId: anonCredsTags.credentialDefinitionId,
      schemaId: anonCredsTags.schemaId,
      credentialRevocationId: anoncredsCredentialMetadata.credentialRevocationId,
      revocationRegistryId: anonCredsTags.revocationRegistryId,
      methodName: anoncredsCredentialMetadata.methodName,
    }
  }

  public async getCredentials(
    agentContext: AgentContext,
    options: GetCredentialsOptions
  ): Promise<AnonCredsCredentialInfo[]> {
    const credentialRecords = await agentContext.dependencyManager
      .resolve(W3cCredentialRepository)
      .findByQuery(agentContext, {
        credentialDefinitionId: options.credentialDefinitionId,
        schemaId: options.schemaId,
        issuerId: options.issuerId,
        schemaName: options.schemaName,
        schemaVersion: options.schemaVersion,
        schemaIssuerId: options.schemaIssuerId,
        methodName: options.methodName,
      })

    return credentialRecords.map((credentialRecord) => this.anoncredsMetadataFromRecord(credentialRecord))
  }

  public async deleteCredential(agentContext: AgentContext, credentialId: string): Promise<void> {
    const credentialRepository = agentContext.dependencyManager.resolve(W3cCredentialRepository)
    const credentialRecord = await credentialRepository.getByCredentialId(agentContext, credentialId)
    await credentialRepository.delete(agentContext, credentialRecord)
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

    return credentials.map((credentialRecord) => {
      return {
        credentialInfo: this.anoncredsMetadataFromRecord(credentialRecord),
        interval: proofRequest.non_revoked,
      }
    })
  }

  private queryFromRestrictions(restrictions: AnonCredsProofRequestRestriction[]) {
    const query: Query<W3cCredentialRecord>[] = []

    const { restrictions: parsedRestrictions } = JsonTransformer.fromJSON({ restrictions }, AnonCredsRestrictionWrapper)

    for (const restriction of parsedRestrictions) {
      const queryElements: SimpleQuery<W3cCredentialRecord> = {}

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
