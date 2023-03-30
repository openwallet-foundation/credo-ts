import type {
  AnonCredsCredential,
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
} from '@aries-framework/anoncreds'
import type { AgentContext, Query, SimpleQuery } from '@aries-framework/core'
import type {
  CredentialEntry,
  CredentialProve,
  CredentialRequestMetadata,
  JsonObject,
} from '@hyperledger/anoncreds-shared'

import {
  AnonCredsCredentialRecord,
  AnonCredsCredentialRepository,
  AnonCredsLinkSecretRepository,
  AnonCredsRestrictionWrapper,
  legacyIndyCredentialDefinitionIdRegex,
  AnonCredsRegistryService,
} from '@aries-framework/anoncreds'
import { AriesFrameworkError, JsonTransformer, TypedArrayEncoder, injectable, utils } from '@aries-framework/core'
import {
  Credential,
  CredentialRequest,
  CredentialRevocationState,
  MasterSecret,
  Presentation,
  RevocationRegistryDefinition,
  RevocationStatusList,
  anoncreds,
} from '@hyperledger/anoncreds-shared'

import { AnonCredsRsError } from '../errors/AnonCredsRsError'

@injectable()
export class AnonCredsRsHolderService implements AnonCredsHolderService {
  public async createLinkSecret(
    agentContext: AgentContext,
    options?: CreateLinkSecretOptions
  ): Promise<CreateLinkSecretReturn> {
    let masterSecret: MasterSecret | undefined
    try {
      masterSecret = MasterSecret.create()

      // FIXME: This is a very specific format of anoncreds-rs. I think it should be simply a string
      const linkSecretJson = masterSecret.toJson() as { value: { ms: string } }

      return {
        linkSecretId: options?.linkSecretId ?? utils.uuid(),
        linkSecretValue: linkSecretJson.value.ms,
      }
    } finally {
      masterSecret?.handle.clear()
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

      const credentialRepository = agentContext.dependencyManager.resolve(AnonCredsCredentialRepository)

      // Cache retrieved credentials in order to minimize storage calls
      const retrievedCredentials = new Map<string, AnonCredsCredentialRecord>()

      const credentialEntryFromAttribute = async (
        attribute: AnonCredsRequestedAttributeMatch | AnonCredsRequestedPredicateMatch
      ): Promise<{ linkSecretId: string; credentialEntry: CredentialEntry }> => {
        let credentialRecord = retrievedCredentials.get(attribute.credentialId)
        if (!credentialRecord) {
          credentialRecord = await credentialRepository.getByCredentialId(agentContext, attribute.credentialId)
          retrievedCredentials.set(attribute.credentialId, credentialRecord)
        }

        const revocationRegistryDefinitionId = credentialRecord.credential.rev_reg_id
        const revocationRegistryIndex = credentialRecord.credentialRevocationId

        // TODO: Check if credential has a revocation registry id (check response from anoncreds-rs API, as it is
        // sending back a mandatory string in Credential.revocationRegistryId)
        const timestamp = attribute.timestamp

        let revocationState: CredentialRevocationState | undefined
        let revocationRegistryDefinition: RevocationRegistryDefinition | undefined
        try {
          if (timestamp && revocationRegistryIndex && revocationRegistryDefinitionId) {
            if (!options.revocationRegistries[revocationRegistryDefinitionId]) {
              throw new AnonCredsRsError(`Revocation Registry ${revocationRegistryDefinitionId} not found`)
            }

            const { definition, tailsFilePath } = options.revocationRegistries[revocationRegistryDefinitionId]

            revocationRegistryDefinition = RevocationRegistryDefinition.fromJson(definition as unknown as JsonObject)
            revocationState = CredentialRevocationState.create({
              revocationRegistryIndex: Number(revocationRegistryIndex),
              revocationRegistryDefinition,
              tailsPath: tailsFilePath,
              revocationStatusList: RevocationStatusList.create({
                issuerId: definition.issuerId,
                issuanceByDefault: true,
                revocationRegistryDefinition,
                revocationRegistryDefinitionId,
                timestamp,
              }),
            })
          }
          return {
            linkSecretId: credentialRecord.linkSecretId,
            credentialEntry: {
              credential: credentialRecord.credential as unknown as JsonObject,
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
        masterSecret: { value: { ms: linkSecretRecord.value } },
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
      const linkSecretRecord = options.linkSecretId
        ? await linkSecretRepository.getByLinkSecretId(agentContext, options.linkSecretId)
        : await linkSecretRepository.findDefault(agentContext)

      if (!linkSecretRecord) {
        // No default link secret
        throw new AnonCredsRsError(
          'No link secret provided to createCredentialRequest and no default link secret has been found'
        )
      }

      const isLegacyIdentifier = credentialOffer.cred_def_id.match(legacyIndyCredentialDefinitionIdRegex)
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
        masterSecret: { value: { ms: linkSecretRecord.value } },
        masterSecretId: linkSecretRecord.linkSecretId,
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

  public async storeCredential(agentContext: AgentContext, options: StoreCredentialOptions): Promise<string> {
    const { credential, credentialDefinition, credentialRequestMetadata, revocationRegistry, schema } = options

    const linkSecretRecord = await agentContext.dependencyManager
      .resolve(AnonCredsLinkSecretRepository)
      .getByLinkSecretId(agentContext, credentialRequestMetadata.master_secret_name)

    const revocationRegistryDefinition = revocationRegistry?.definition as unknown as JsonObject

    const credentialId = options.credentialId ?? utils.uuid()

    let credentialObj: Credential | undefined
    let processedCredential: Credential | undefined
    try {
      credentialObj = Credential.fromJson(credential as unknown as JsonObject)
      processedCredential = credentialObj.process({
        credentialDefinition: credentialDefinition as unknown as JsonObject,
        credentialRequestMetadata: credentialRequestMetadata as unknown as JsonObject,
        masterSecret: { value: { ms: linkSecretRecord.value } },
        revocationRegistryDefinition,
      })

      const credentialRepository = agentContext.dependencyManager.resolve(AnonCredsCredentialRepository)

      const methodName = agentContext.dependencyManager
        .resolve(AnonCredsRegistryService)
        .getRegistryForIdentifier(agentContext, credential.cred_def_id).methodName

      await credentialRepository.save(
        agentContext,
        new AnonCredsCredentialRecord({
          credential: processedCredential.toJson() as unknown as AnonCredsCredential,
          credentialId,
          linkSecretId: linkSecretRecord.linkSecretId,
          issuerId: options.credentialDefinition.issuerId,
          schemaName: schema.name,
          schemaIssuerId: schema.issuerId,
          schemaVersion: schema.version,
          credentialRevocationId: processedCredential.revocationRegistryIndex?.toString(),
          methodName,
        })
      )

      return credentialId
    } finally {
      credentialObj?.handle.clear()
      processedCredential?.handle.clear()
    }
  }

  public async getCredential(
    agentContext: AgentContext,
    options: GetCredentialOptions
  ): Promise<AnonCredsCredentialInfo> {
    const credentialRecord = await agentContext.dependencyManager
      .resolve(AnonCredsCredentialRepository)
      .getByCredentialId(agentContext, options.credentialId)

    const attributes: { [key: string]: string } = {}
    for (const attribute in credentialRecord.credential.values) {
      attributes[attribute] = credentialRecord.credential.values[attribute].raw
    }
    return {
      attributes,
      credentialDefinitionId: credentialRecord.credential.cred_def_id,
      credentialId: credentialRecord.credentialId,
      schemaId: credentialRecord.credential.schema_id,
      credentialRevocationId: credentialRecord.credentialRevocationId,
      revocationRegistryId: credentialRecord.credential.rev_reg_id,
      methodName: credentialRecord.methodName,
    }
  }

  public async getCredentials(
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

    return credentialRecords.map((credentialRecord) => ({
      attributes: Object.fromEntries(
        Object.entries(credentialRecord.credential.values).map(([key, value]) => [key, value.raw])
      ),
      credentialDefinitionId: credentialRecord.credential.cred_def_id,
      credentialId: credentialRecord.credentialId,
      schemaId: credentialRecord.credential.schema_id,
      credentialRevocationId: credentialRecord.credentialRevocationId,
      revocationRegistryId: credentialRecord.credential.rev_reg_id,
      methodName: credentialRecord.methodName,
    }))
  }

  public async deleteCredential(agentContext: AgentContext, credentialId: string): Promise<void> {
    const credentialRepository = agentContext.dependencyManager.resolve(AnonCredsCredentialRepository)
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
    const attributeQuery: SimpleQuery<AnonCredsCredentialRecord> = {}
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
      .resolve(AnonCredsCredentialRepository)
      .findByQuery(agentContext, {
        $and,
      })

    return credentials.map((credentialRecord) => {
      const attributes: { [key: string]: string } = {}
      for (const attribute in credentialRecord.credential.values) {
        attributes[attribute] = credentialRecord.credential.values[attribute].raw
      }
      return {
        credentialInfo: {
          attributes,
          credentialDefinitionId: credentialRecord.credential.cred_def_id,
          credentialId: credentialRecord.credentialId,
          schemaId: credentialRecord.credential.schema_id,
          credentialRevocationId: credentialRecord.credentialRevocationId,
          revocationRegistryId: credentialRecord.credential.rev_reg_id,
          methodName: credentialRecord.methodName,
        },
        interval: proofRequest.non_revoked,
      }
    })
  }

  private queryFromRestrictions(restrictions: AnonCredsProofRequestRestriction[]) {
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
