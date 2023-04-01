import {
  AnonCredsIssuerService,
  CreateCredentialDefinitionOptions,
  CreateCredentialOfferOptions,
  CreateCredentialOptions,
  CreateCredentialReturn,
  CreateSchemaOptions,
  AnonCredsCredentialOffer,
  AnonCredsSchema,
  AnonCredsCredentialDefinition,
  CreateCredentialDefinitionReturn,
  AnonCredsCredential,
  CreateRevocationRegistryDefinitionOptions,
  CreateRevocationRegistryDefinitionReturn,
  AnonCredsRevocationRegistryDefinition,
  CreateRevocationStatusListOptions,
  AnonCredsRevocationStatusList,
  RevocationRegistryState,
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'
import type { CredentialDefinitionPrivate, JsonObject, KeyCorrectnessProof } from '@hyperledger/anoncreds-shared'

import {
  AnonCredsRevocationRegistryDefinitionRepository,
  AnonCredsRevocationRegistryDefinitionPrivateRepository,
  AnonCredsKeyCorrectnessProofRepository,
  AnonCredsCredentialDefinitionPrivateRepository,
  AnonCredsCredentialDefinitionRepository,
} from '@aries-framework/anoncreds'
import { injectable, AriesFrameworkError } from '@aries-framework/core'
import {
  RevocationStatusList,
  RevocationRegistryDefinitionPrivate,
  RevocationRegistryDefinition,
  CredentialRevocationConfig,
  Credential,
  CredentialDefinition,
  CredentialOffer,
  Schema,
} from '@hyperledger/anoncreds-shared'

import { AnonCredsRsError } from '../errors/AnonCredsRsError'

@injectable()
export class AnonCredsRsIssuerService implements AnonCredsIssuerService {
  public async createSchema(agentContext: AgentContext, options: CreateSchemaOptions): Promise<AnonCredsSchema> {
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
    agentContext: AgentContext,
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
    agentContext: AgentContext,
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
        tailsHash: createReturnObj.revocationRegistryDefinition.getTailsHash(),
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
    const { issuerId, revocationRegistryDefinitionId, revocationRegistryDefinition, issuanceByDefault } = options

    let revocationStatusList: RevocationStatusList | undefined
    try {
      revocationStatusList = RevocationStatusList.create({
        issuanceByDefault,
        revocationRegistryDefinitionId,
        revocationRegistryDefinition: revocationRegistryDefinition as unknown as JsonObject,
        issuerId,
      })

      return revocationStatusList.toJson() as unknown as AnonCredsRevocationStatusList
    } finally {
      revocationStatusList?.handle.clear()
    }
  }

  public async createCredentialOffer(
    agentContext: AgentContext,
    options: CreateCredentialOfferOptions
  ): Promise<AnonCredsCredentialOffer> {
    const { credentialDefinitionId } = options

    let credentialOffer: CredentialOffer | undefined
    try {
      const credentialDefinitionRecord = await agentContext.dependencyManager
        .resolve(AnonCredsCredentialDefinitionRepository)
        .getByCredentialDefinitionId(agentContext, options.credentialDefinitionId)

      const keyCorrectnessProofRecord = await agentContext.dependencyManager
        .resolve(AnonCredsKeyCorrectnessProofRepository)
        .getByCredentialDefinitionId(agentContext, options.credentialDefinitionId)

      if (!credentialDefinitionRecord) {
        throw new AnonCredsRsError(`Credential Definition ${credentialDefinitionId} not found`)
      }

      credentialOffer = CredentialOffer.create({
        credentialDefinitionId,
        keyCorrectnessProof: keyCorrectnessProofRecord?.value,
        schemaId: credentialDefinitionRecord.credentialDefinition.schemaId,
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
      tailsFilePath,
      revocationStatusList,
    } = options

    const definedRevocationOptions = [revocationRegistryDefinitionId, tailsFilePath, revocationStatusList].filter(
      (e) => e !== undefined
    )
    if (definedRevocationOptions.length > 0 && definedRevocationOptions.length < 3) {
      throw new AriesFrameworkError(
        'Revocation requires all of revocationRegistryDefinitionId, revocationStatusList and tailsFilePath'
      )
    }

    let credential: Credential | undefined
    try {
      const attributeRawValues: Record<string, string> = {}
      const attributeEncodedValues: Record<string, string> = {}

      Object.keys(credentialValues).forEach((key) => {
        attributeRawValues[key] = credentialValues[key].raw
        attributeEncodedValues[key] = credentialValues[key].encoded
      })

      const credentialDefinitionRecord = await agentContext.dependencyManager
        .resolve(AnonCredsCredentialDefinitionRepository)
        .getByCredentialDefinitionId(agentContext, options.credentialRequest.cred_def_id)

      const credentialDefinitionPrivateRecord = await agentContext.dependencyManager
        .resolve(AnonCredsCredentialDefinitionPrivateRepository)
        .getByCredentialDefinitionId(agentContext, options.credentialRequest.cred_def_id)

      let revocationConfiguration: CredentialRevocationConfig | undefined
      if (options.revocationRegistryDefinitionId && options.tailsFilePath) {
        const revocationRegistryDefinitionRecord = await agentContext.dependencyManager
          .resolve(AnonCredsRevocationRegistryDefinitionRepository)
          .getByRevocationRegistryDefinitionId(agentContext, options.revocationRegistryDefinitionId)

        const revocationRegistryDefinitionPrivateRecord = await agentContext.dependencyManager
          .resolve(AnonCredsRevocationRegistryDefinitionPrivateRepository)
          .getByRevocationRegistryDefinitionId(agentContext, options.revocationRegistryDefinitionId)

        const registryIndex = revocationRegistryDefinitionPrivateRecord.currentIndex + 1

        if (registryIndex >= revocationRegistryDefinitionRecord.revocationRegistryDefinition.value.maxCredNum) {
          revocationRegistryDefinitionPrivateRecord.state = RevocationRegistryState.Full
        }

        // Update current registry index in storage
        // Note: if an error is produced or the credential is not effectively sent,
        // the previous index will be skipped
        revocationRegistryDefinitionPrivateRecord.currentIndex = registryIndex
        await agentContext.dependencyManager
          .resolve(AnonCredsRevocationRegistryDefinitionPrivateRepository)
          .update(agentContext, revocationRegistryDefinitionPrivateRecord)

        revocationConfiguration = new CredentialRevocationConfig({
          registryDefinition: RevocationRegistryDefinition.fromJson(
            revocationRegistryDefinitionRecord.revocationRegistryDefinition as unknown as JsonObject
          ),
          registryDefinitionPrivate: RevocationRegistryDefinitionPrivate.fromJson(
            revocationRegistryDefinitionPrivateRecord.value
          ),
          tailsPath: options.tailsFilePath,
          registryIndex,
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
        revocationStatusList: revocationStatusList ? (revocationStatusList as unknown as JsonObject) : undefined,
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
