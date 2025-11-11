import type { AgentContext } from '@credo-ts/core'
import { CredoError, injectable } from '@credo-ts/core'
import type { CredentialDefinitionPrivate, JsonObject, KeyCorrectnessProof } from '@hyperledger/anoncreds-shared'
import {
  Credential,
  CredentialDefinition,
  CredentialOffer,
  CredentialRevocationConfig,
  RevocationRegistryDefinition,
  RevocationRegistryDefinitionPrivate,
  RevocationStatusList,
  Schema,
} from '@hyperledger/anoncreds-shared'
import { AnonCredsRsError } from '../error'
import type {
  AnonCredsCredential,
  AnonCredsCredentialDefinition,
  AnonCredsCredentialOffer,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsRevocationStatusList,
  AnonCredsSchema,
} from '../models'
import {
  AnonCredsCredentialDefinitionPrivateRepository,
  AnonCredsCredentialDefinitionRepository,
  AnonCredsKeyCorrectnessProofRepository,
  AnonCredsRevocationRegistryDefinitionPrivateRepository,
  AnonCredsRevocationRegistryDefinitionRepository,
  AnonCredsRevocationRegistryState,
} from '../repository'
import type {
  AnonCredsIssuerService,
  CreateCredentialDefinitionOptions,
  CreateCredentialDefinitionReturn,
  CreateCredentialOfferOptions,
  CreateCredentialOptions,
  CreateCredentialReturn,
  CreateRevocationRegistryDefinitionOptions,
  CreateRevocationRegistryDefinitionReturn,
  CreateRevocationStatusListOptions,
  CreateSchemaOptions,
  UpdateRevocationStatusListOptions,
} from '../services'
import {
  getUnqualifiedSchemaId,
  isUnqualifiedCredentialDefinitionId,
  parseIndyDid,
  parseIndySchemaId,
} from '../utils/indyIdentifiers'

@injectable()
export class AnonCredsRsIssuerService implements AnonCredsIssuerService {
  public async createSchema(_agentContext: AgentContext, options: CreateSchemaOptions): Promise<AnonCredsSchema> {
    const { issuerId, name, version, attrNames: attributeNames } = options

    let schema: Schema | undefined
    try {
      const schema = Schema.create({
        issuerId,
        name,
        version,
        attributeNames,
      })

      return schema.toJson() as unknown as AnonCredsSchema
    } finally {
      schema?.handle.clear()
    }
  }

  public async createCredentialDefinition(
    _agentContext: AgentContext,
    options: CreateCredentialDefinitionOptions
  ): Promise<CreateCredentialDefinitionReturn> {
    const { tag, supportRevocation, schema, issuerId, schemaId } = options

    let createReturnObj:
      | {
          credentialDefinition: CredentialDefinition
          credentialDefinitionPrivate: CredentialDefinitionPrivate
          keyCorrectnessProof: KeyCorrectnessProof
        }
      | undefined
    try {
      createReturnObj = CredentialDefinition.create({
        schema: schema as unknown as JsonObject,
        issuerId,
        schemaId,
        tag,
        supportRevocation,
        signatureType: 'CL',
      })

      return {
        credentialDefinition: createReturnObj.credentialDefinition.toJson() as unknown as AnonCredsCredentialDefinition,
        credentialDefinitionPrivate: createReturnObj.credentialDefinitionPrivate.toJson(),
        keyCorrectnessProof: createReturnObj.keyCorrectnessProof.toJson(),
      }
    } finally {
      createReturnObj?.credentialDefinition.handle.clear()
      createReturnObj?.credentialDefinitionPrivate.handle.clear()
      createReturnObj?.keyCorrectnessProof.handle.clear()
    }
  }

  public async createRevocationRegistryDefinition(
    _agentContext: AgentContext,
    options: CreateRevocationRegistryDefinitionOptions
  ): Promise<CreateRevocationRegistryDefinitionReturn> {
    const { tag, issuerId, credentialDefinition, credentialDefinitionId, maximumCredentialNumber, tailsDirectoryPath } =
      options

    let createReturnObj:
      | {
          revocationRegistryDefinition: RevocationRegistryDefinition
          revocationRegistryDefinitionPrivate: RevocationRegistryDefinitionPrivate
        }
      | undefined
    try {
      createReturnObj = RevocationRegistryDefinition.create({
        credentialDefinition: credentialDefinition as unknown as JsonObject,
        credentialDefinitionId,
        issuerId,
        maximumCredentialNumber,
        revocationRegistryType: 'CL_ACCUM',
        tag,
        tailsDirectoryPath,
      })

      return {
        revocationRegistryDefinition:
          createReturnObj.revocationRegistryDefinition.toJson() as unknown as AnonCredsRevocationRegistryDefinition,
        revocationRegistryDefinitionPrivate: createReturnObj.revocationRegistryDefinitionPrivate.toJson(),
      }
    } finally {
      createReturnObj?.revocationRegistryDefinition.handle.clear()
      createReturnObj?.revocationRegistryDefinitionPrivate.handle.clear()
    }
  }

  public async createRevocationStatusList(
    agentContext: AgentContext,
    options: CreateRevocationStatusListOptions
  ): Promise<AnonCredsRevocationStatusList> {
    const { issuerId, revocationRegistryDefinitionId, revocationRegistryDefinition } = options

    const credentialDefinitionRecord = await agentContext.dependencyManager
      .resolve(AnonCredsCredentialDefinitionRepository)
      .getByCredentialDefinitionId(agentContext, revocationRegistryDefinition.credDefId)

    const revocationRegistryDefinitionPrivateRecord = await agentContext.dependencyManager
      .resolve(AnonCredsRevocationRegistryDefinitionPrivateRepository)
      .getByRevocationRegistryDefinitionId(agentContext, revocationRegistryDefinitionId)

    let revocationStatusList: RevocationStatusList | undefined
    try {
      revocationStatusList = RevocationStatusList.create({
        issuanceByDefault: true,
        revocationRegistryDefinitionId,
        credentialDefinition: credentialDefinitionRecord.credentialDefinition as unknown as JsonObject,
        revocationRegistryDefinition: revocationRegistryDefinition as unknown as JsonObject,
        revocationRegistryDefinitionPrivate: revocationRegistryDefinitionPrivateRecord.value as unknown as JsonObject,
        issuerId,
      })

      return revocationStatusList.toJson() as unknown as AnonCredsRevocationStatusList
    } finally {
      revocationStatusList?.handle.clear()
    }
  }

  public async updateRevocationStatusList(
    agentContext: AgentContext,
    options: UpdateRevocationStatusListOptions
  ): Promise<AnonCredsRevocationStatusList> {
    const { revocationStatusList, revocationRegistryDefinition, issued, revoked, timestamp, tailsFilePath } = options

    let updatedRevocationStatusList: RevocationStatusList | undefined
    let revocationRegistryDefinitionObj: RevocationRegistryDefinition | undefined

    try {
      updatedRevocationStatusList = RevocationStatusList.fromJson(revocationStatusList as unknown as JsonObject)

      if (timestamp && !issued && !revoked) {
        updatedRevocationStatusList.updateTimestamp({
          timestamp,
        })
      } else {
        const credentialDefinitionRecord = await agentContext.dependencyManager
          .resolve(AnonCredsCredentialDefinitionRepository)
          .getByCredentialDefinitionId(agentContext, revocationRegistryDefinition.credDefId)

        const revocationRegistryDefinitionPrivateRecord = await agentContext.dependencyManager
          .resolve(AnonCredsRevocationRegistryDefinitionPrivateRepository)
          .getByRevocationRegistryDefinitionId(agentContext, revocationStatusList.revRegDefId)

        revocationRegistryDefinitionObj = RevocationRegistryDefinition.fromJson({
          ...revocationRegistryDefinition,
          value: { ...revocationRegistryDefinition.value, tailsLocation: tailsFilePath },
        } as unknown as JsonObject)
        updatedRevocationStatusList.update({
          credentialDefinition: credentialDefinitionRecord.credentialDefinition as unknown as JsonObject,
          revocationRegistryDefinition: revocationRegistryDefinitionObj,
          revocationRegistryDefinitionPrivate: revocationRegistryDefinitionPrivateRecord.value,
          issued: options.issued,
          revoked: options.revoked,
          timestamp: timestamp ?? -1, // FIXME: this should be fixed in anoncreds-rs wrapper
        })
      }

      return updatedRevocationStatusList.toJson() as unknown as AnonCredsRevocationStatusList
    } finally {
      updatedRevocationStatusList?.handle.clear()
      revocationRegistryDefinitionObj?.handle.clear()
    }
  }

  public async createCredentialOffer(
    agentContext: AgentContext,
    options: CreateCredentialOfferOptions
  ): Promise<AnonCredsCredentialOffer> {
    const { credentialDefinitionId } = options

    let credentialOffer: CredentialOffer | undefined
    try {
      // The getByCredentialDefinitionId supports both qualified and unqualified identifiers, even though the
      // record is always stored using the qualified identifier.
      const credentialDefinitionRecord = await agentContext.dependencyManager
        .resolve(AnonCredsCredentialDefinitionRepository)
        .getByCredentialDefinitionId(agentContext, options.credentialDefinitionId)

      // We fetch the keyCorrectnessProof based on the credential definition record id, as the
      // credential definition id passed to this module could be unqualified, and the key correctness
      // proof is only stored using the qualified identifier.
      const keyCorrectnessProofRecord = await agentContext.dependencyManager
        .resolve(AnonCredsKeyCorrectnessProofRepository)
        .getByCredentialDefinitionId(agentContext, credentialDefinitionRecord.credentialDefinitionId)

      if (!credentialDefinitionRecord) {
        throw new AnonCredsRsError(`Credential Definition ${credentialDefinitionId} not found`)
      }

      let schemaId = credentialDefinitionRecord.credentialDefinition.schemaId

      // if the credentialDefinitionId is not qualified, we need to transform the schemaId to also be unqualified
      if (isUnqualifiedCredentialDefinitionId(options.credentialDefinitionId)) {
        const { namespaceIdentifier, schemaName, schemaVersion } = parseIndySchemaId(schemaId)
        schemaId = getUnqualifiedSchemaId(namespaceIdentifier, schemaName, schemaVersion)
      }

      credentialOffer = CredentialOffer.create({
        credentialDefinitionId,
        keyCorrectnessProof: keyCorrectnessProofRecord?.value,
        schemaId,
      })

      return credentialOffer.toJson() as unknown as AnonCredsCredentialOffer
    } finally {
      credentialOffer?.handle.clear()
    }
  }

  public async createCredential(
    agentContext: AgentContext,
    options: CreateCredentialOptions
  ): Promise<CreateCredentialReturn> {
    const {
      credentialOffer,
      credentialRequest,
      credentialValues,
      revocationRegistryDefinitionId,
      revocationStatusList,
      revocationRegistryIndex,
    } = options

    const definedRevocationOptions = [
      revocationRegistryDefinitionId,
      revocationStatusList,
      revocationRegistryIndex,
    ].filter((e) => e !== undefined)
    if (definedRevocationOptions.length > 0 && definedRevocationOptions.length < 3) {
      throw new CredoError(
        'Revocation requires all of revocationRegistryDefinitionId, revocationRegistryIndex and revocationStatusList'
      )
    }

    let credential: Credential | undefined
    try {
      const attributeRawValues: Record<string, string> = {}
      const attributeEncodedValues: Record<string, string> = {}

      for (const key of Object.keys(credentialValues)) {
        attributeRawValues[key] = credentialValues[key].raw
        attributeEncodedValues[key] = credentialValues[key].encoded
      }

      const credentialDefinitionRecord = await agentContext.dependencyManager
        .resolve(AnonCredsCredentialDefinitionRepository)
        .getByCredentialDefinitionId(agentContext, options.credentialRequest.cred_def_id)

      // We fetch the private record based on the cred def id from the cred def record, as the
      // credential definition id passed to this module could be unqualified, and the private record
      // is only stored using the qualified identifier.
      const credentialDefinitionPrivateRecord = await agentContext.dependencyManager
        .resolve(AnonCredsCredentialDefinitionPrivateRepository)
        .getByCredentialDefinitionId(agentContext, credentialDefinitionRecord.credentialDefinitionId)

      let credentialDefinition = credentialDefinitionRecord.credentialDefinition

      if (isUnqualifiedCredentialDefinitionId(options.credentialRequest.cred_def_id)) {
        const { namespaceIdentifier, schemaName, schemaVersion } = parseIndySchemaId(credentialDefinition.schemaId)
        const { namespaceIdentifier: unqualifiedDid } = parseIndyDid(credentialDefinition.issuerId)
        credentialDefinition = {
          ...credentialDefinition,
          schemaId: getUnqualifiedSchemaId(namespaceIdentifier, schemaName, schemaVersion),
          issuerId: unqualifiedDid,
        }
      }

      let revocationConfiguration: CredentialRevocationConfig | undefined
      if (revocationRegistryDefinitionId && revocationStatusList && revocationRegistryIndex !== undefined) {
        const revocationRegistryDefinitionRecord = await agentContext.dependencyManager
          .resolve(AnonCredsRevocationRegistryDefinitionRepository)
          .getByRevocationRegistryDefinitionId(agentContext, revocationRegistryDefinitionId)

        const revocationRegistryDefinitionPrivateRecord = await agentContext.dependencyManager
          .resolve(AnonCredsRevocationRegistryDefinitionPrivateRepository)
          .getByRevocationRegistryDefinitionId(agentContext, revocationRegistryDefinitionId)

        if (
          revocationRegistryIndex >= revocationRegistryDefinitionRecord.revocationRegistryDefinition.value.maxCredNum
        ) {
          revocationRegistryDefinitionPrivateRecord.state = AnonCredsRevocationRegistryState.Full
        }

        revocationConfiguration = new CredentialRevocationConfig({
          registryDefinition: RevocationRegistryDefinition.fromJson(
            revocationRegistryDefinitionRecord.revocationRegistryDefinition as unknown as JsonObject
          ),
          registryDefinitionPrivate: RevocationRegistryDefinitionPrivate.fromJson(
            revocationRegistryDefinitionPrivateRecord.value
          ),
          statusList: RevocationStatusList.fromJson(revocationStatusList as unknown as JsonObject),
          registryIndex: revocationRegistryIndex,
        })
      }
      credential = Credential.create({
        credentialDefinition: credentialDefinitionRecord.credentialDefinition as unknown as JsonObject,
        credentialOffer: credentialOffer as unknown as JsonObject,
        credentialRequest: credentialRequest as unknown as JsonObject,
        revocationRegistryId: revocationRegistryDefinitionId,
        attributeEncodedValues,
        attributeRawValues,
        credentialDefinitionPrivate: credentialDefinitionPrivateRecord.value,
        revocationConfiguration,
        // FIXME: duplicated input parameter?
        revocationStatusList: revocationStatusList
          ? RevocationStatusList.fromJson(revocationStatusList as unknown as JsonObject)
          : undefined,
      })

      return {
        credential: credential.toJson() as unknown as AnonCredsCredential,
        credentialRevocationId: credential.revocationRegistryIndex?.toString(),
      }
    } finally {
      credential?.handle.clear()
    }
  }
}
