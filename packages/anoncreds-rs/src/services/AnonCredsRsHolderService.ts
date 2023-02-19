import type {
  AnonCredsHolderService,
  AnonCredsProof,
  CreateCredentialRequestOptions,
  CreateCredentialRequestReturn,
  CreateProofOptions,
  GetCredentialOptions,
  StoreCredentialOptions,
  GetCredentialsForProofRequestOptions,
  GetCredentialsForProofRequestReturn,
  AnonCredsCredentialInfo,
  CreateLinkSecretOptions,
  CreateLinkSecretReturn,
  AnonCredsProofRequestRestriction,
  AnonCredsCredential,
  AnonCredsRequestedAttributeMatch,
  AnonCredsRequestedPredicateMatch,
} from '@aries-framework/anoncreds'
import type { AgentContext, Query, SimpleQuery } from '@aries-framework/core'
import type { CredentialEntry, CredentialProve } from '@hyperledger/anoncreds-shared'

import {
  AnonCredsCredentialRecord,
  AnonCredsLinkSecretRepository,
  AnonCredsCredentialRepository,
} from '@aries-framework/anoncreds'
import { utils, injectable } from '@aries-framework/core'
import {
  CredentialRequestMetadata,
  Credential,
  CredentialDefinition,
  CredentialOffer,
  CredentialRequest,
  CredentialRevocationState,
  MasterSecret,
  Presentation,
  PresentationRequest,
  RevocationRegistryDefinition,
  RevocationStatusList,
  Schema,
} from '@hyperledger/anoncreds-shared'

import { AnonCredsRsError } from '../errors/AnonCredsRsError'

@injectable()
export class AnonCredsRsHolderService implements AnonCredsHolderService {
  public async createLinkSecret(
    agentContext: AgentContext,
    options?: CreateLinkSecretOptions
  ): Promise<CreateLinkSecretReturn> {
    try {
      return {
        linkSecretId: options?.linkSecretId ?? utils.uuid(),
        linkSecretValue: JSON.parse(MasterSecret.create().toJson()).value.ms,
      }
    } catch (error) {
      agentContext.config.logger.error(`Error creating Link Secret`, {
        error,
      })
      throw new AnonCredsRsError('Error creating Link Secret', { cause: error })
    }
  }

  public async createProof(agentContext: AgentContext, options: CreateProofOptions): Promise<AnonCredsProof> {
    const { credentialDefinitions, proofRequest, selectedCredentials, schemas } = options

    try {
      const rsCredentialDefinitions: Record<string, CredentialDefinition> = {}
      for (const credDefId in credentialDefinitions) {
        rsCredentialDefinitions[credDefId] = CredentialDefinition.load(JSON.stringify(credentialDefinitions[credDefId]))
      }

      const rsSchemas: Record<string, Schema> = {}
      for (const schemaId in schemas) {
        rsSchemas[schemaId] = Schema.load(JSON.stringify(schemas[schemaId]))
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

        const credential = Credential.load(JSON.stringify(credentialRecord.credential))

        const revocationRegistryDefinitionId = credential.revocationRegistryId
        const revocationRegistryIndex = credential.revocationRegistryIndex

        // TODO: Check if credential has a revocation registry id (check response from anoncreds-rs API, as it is
        // sending back a mandatory string in Credential.revocationRegistryId)
        const timestamp = attribute.timestamp

        let revocationState
        if (timestamp) {
          if (revocationRegistryIndex) {
            if (!options.revocationRegistries[revocationRegistryDefinitionId]) {
              throw new AnonCredsRsError(`Revocation Registry ${revocationRegistryDefinitionId} not found`)
            }

            const { definition, tailsFilePath } = options.revocationRegistries[revocationRegistryDefinitionId]

            const revocationRegistryDefinition = RevocationRegistryDefinition.load(JSON.stringify(definition))
            revocationState = CredentialRevocationState.create({
              revocationRegistryIndex,
              revocationRegistryDefinition,
              tailsPath: tailsFilePath,
              revocationStatusList: RevocationStatusList.create({
                issuanceByDefault: true,
                revocationRegistryDefinition,
                revocationRegistryDefinitionId,
                timestamp,
              }),
            })
          }
        }
        return {
          linkSecretId: credentialRecord.linkSecretId,
          credentialEntry: {
            credential,
            revocationState,
            timestamp,
          },
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

      const presentation = Presentation.create({
        credentialDefinitions: rsCredentialDefinitions,
        schemas: rsSchemas,
        presentationRequest: PresentationRequest.load(JSON.stringify(proofRequest)),
        credentials: credentials.map((entry) => entry.credentialEntry),
        credentialsProve,
        selfAttest: selectedCredentials.selfAttestedAttributes,
        masterSecret: MasterSecret.load(JSON.stringify({ value: { ms: linkSecretRecord.value } })),
      })

      return JSON.parse(presentation.toJson())
    } catch (error) {
      agentContext.config.logger.error(`Error creating AnonCreds Proof`, {
        error,
        proofRequest,
        selectedCredentials,
      })
      throw new AnonCredsRsError(`Error creating proof: ${error}`, { cause: error })
    }
  }

  public async createCredentialRequest(
    agentContext: AgentContext,
    options: CreateCredentialRequestOptions
  ): Promise<CreateCredentialRequestReturn> {
    const { credentialDefinition, credentialOffer } = options
    try {
      const linkSecretRepository = agentContext.dependencyManager.resolve(AnonCredsLinkSecretRepository)

      // If a link secret is specified, use it. Otherwise, attempt to use default link secret
      const linkSecretRecord = options.linkSecretId
        ? await linkSecretRepository.getByLinkSecretId(agentContext, options.linkSecretId)
        : await linkSecretRepository.findDefault(agentContext)

      if (!linkSecretRecord) {
        // No default link secret
        throw new AnonCredsRsError('No default link secret has been found')
      }

      const { credentialRequest, credentialRequestMetadata } = CredentialRequest.create({
        credentialDefinition: CredentialDefinition.load(JSON.stringify(credentialDefinition)),
        credentialOffer: CredentialOffer.load(JSON.stringify(credentialOffer)),
        masterSecret: MasterSecret.load(JSON.stringify({ value: { ms: linkSecretRecord.value } })),
        masterSecretId: linkSecretRecord.linkSecretId,
      })

      return {
        credentialRequest: JSON.parse(credentialRequest.toJson()),
        credentialRequestMetadata: JSON.parse(credentialRequestMetadata.toJson()),
      }
    } catch (error) {
      throw new AnonCredsRsError(`Error creating credential request: ${error}`, { cause: error })
    }
  }

  public async storeCredential(agentContext: AgentContext, options: StoreCredentialOptions): Promise<string> {
    const { credential, credentialDefinition, credentialRequestMetadata, revocationRegistry, schema } = options

    const linkSecretRecord = await agentContext.dependencyManager
      .resolve(AnonCredsLinkSecretRepository)
      .getByLinkSecretId(agentContext, credentialRequestMetadata.master_secret_name)

    const revocationRegistryDefinition = revocationRegistry?.definition
      ? RevocationRegistryDefinition.load(JSON.stringify(revocationRegistry.definition))
      : undefined

    const credentialId = options.credentialId ?? utils.uuid()
    const processedCredential = Credential.load(JSON.stringify(credential)).process({
      credentialDefinition: CredentialDefinition.load(JSON.stringify(credentialDefinition)),
      credentialRequestMetadata: CredentialRequestMetadata.load(JSON.stringify(credentialRequestMetadata)),
      masterSecret: MasterSecret.load(JSON.stringify({ value: { ms: linkSecretRecord.value } })),
      revocationRegistryDefinition,
    })

    const credentialRepository = agentContext.dependencyManager.resolve(AnonCredsCredentialRepository)

    await credentialRepository.save(
      agentContext,
      new AnonCredsCredentialRecord({
        credential: JSON.parse(processedCredential.toJson()) as AnonCredsCredential,
        credentialId,
        linkSecretId: linkSecretRecord.linkSecretId,
        issuerId: options.credentialDefinition.issuerId,
        schemaName: schema.name,
        schemaIssuerId: schema.issuerId,
        schemaVersion: schema.version,
      })
    )

    return credentialId
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
    }
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
    const attributes = requestedAttribute.name ? [requestedAttribute.name] : requestedAttribute.names

    const restrictionQuery = requestedAttribute.restrictions
      ? this.queryFromRestrictions(requestedAttribute.restrictions)
      : undefined

    const query: Query<AnonCredsCredentialRecord> = {
      attributes,
      ...restrictionQuery,
      ...options.extraQuery,
    }

    const credentials = await agentContext.dependencyManager
      .resolve(AnonCredsCredentialRepository)
      .findByQuery(agentContext, query)

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
        },
        interval: proofRequest.non_revoked,
      }
    })
  }

  private queryFromRestrictions(restrictions: AnonCredsProofRequestRestriction[]) {
    const query: Query<AnonCredsCredentialRecord>[] = []

    for (const restriction of restrictions) {
      const queryElements: SimpleQuery<AnonCredsCredentialRecord> = {}

      if (restriction.cred_def_id) {
        queryElements.credentialDefinitionId = restriction.cred_def_id
      }

      if (restriction.issuer_id || restriction.issuer_did) {
        queryElements.issuerId = restriction.issuer_id ?? restriction.issuer_did
      }

      if (restriction.rev_reg_id) {
        queryElements.revocationRegistryId = restriction.rev_reg_id
      }

      if (restriction.schema_id) {
        queryElements.schemaId = restriction.schema_id
      }

      if (restriction.schema_issuer_id || restriction.schema_issuer_did) {
        queryElements.schemaIssuerId = restriction.schema_issuer_id ?? restriction.schema_issuer_did
      }

      if (restriction.schema_name) {
        queryElements.schemaName = restriction.schema_name
      }

      if (restriction.schema_version) {
        queryElements.schemaVersion = restriction.schema_version
      }

      query.push(queryElements)
    }

    return query.length === 1 ? query[0] : { $or: query }
  }
}
