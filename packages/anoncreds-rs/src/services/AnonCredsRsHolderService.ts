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
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'
import type { CredentialEntry, CredentialProve } from '@hyperledger/anoncreds-shared'

import { AnonCredsLinkSecretRepository, AnonCredsCredentialRepository } from '@aries-framework/anoncreds'
import {
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

import { uuid } from '../../../core/src/utils/uuid'
import { AnonCredsRsError } from '../errors/AnonCredsRsError'

export class AnonCredsRsHolderService implements AnonCredsHolderService {
  public async createLinkSecret(
    agentContext: AgentContext,
    options: CreateLinkSecretOptions
  ): Promise<CreateLinkSecretReturn> {
    try {
      return {
        linkSecretId: options.linkSecretId ?? uuid(),
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
    const { credentialDefinitions, proofRequest, requestedCredentials, schemas } = options

    try {
      const rsCredentialDefinitions: Record<string, CredentialDefinition> = {}
      for (const credDefId in credentialDefinitions) {
        rsCredentialDefinitions[credDefId] = CredentialDefinition.load(JSON.stringify(credentialDefinitions[credDefId]))
      }

      const rsSchemas: Record<string, Schema> = {}
      for (const schemaId in schemas) {
        rsSchemas[schemaId] = Schema.load(JSON.stringify(schemas[schemaId]))
      }

      const credentialIds = new Set<string>()
      const credentialsProve: CredentialProve[] = []

      let entryIndex = 0
      for (const referent in requestedCredentials.requestedAttributes) {
        const attribute = requestedCredentials.requestedAttributes[referent]
        credentialIds.add(attribute.credentialId)
        credentialsProve.push({ entryIndex, isPredicate: false, referent, reveal: attribute.revealed })
        entryIndex = entryIndex + 1
      }

      for (const referent in requestedCredentials.requestedPredicates) {
        const predicate = requestedCredentials.requestedPredicates[referent]
        credentialIds.add(predicate.credentialId)
        credentialsProve.push({ entryIndex, isPredicate: true, referent, reveal: true })
        entryIndex = entryIndex + 1
      }

      const credentials: CredentialEntry[] = []

      const credentialRepository = agentContext.dependencyManager.resolve(AnonCredsCredentialRepository)

      // Get all requested credentials and take linkSecret. If it's not the same for every credential, throw error
      let linkSecretId
      for (const credentialId of credentialIds) {
        const credentialRecord = await credentialRepository.getByCredentialId(agentContext, credentialId)

        const credential = Credential.load(JSON.stringify(credentialRecord.credential))
        const revocationRegistryDefinitionId = credential.revocationRegistryId

        if (!linkSecretId) {
          linkSecretId = credentialRecord.linkSecretId
        } else {
          if (linkSecretId !== credentialRecord.linkSecretId) {
            throw new AnonCredsRsError('All credentials in a Proof should have been issued using the same Link Secret')
          }
        }

        const revocationRegistryIndex = credential.revocationRegistryIndex ?? 0 // FIXME: case where revocationRegistryIndex is not defined

        if (!options.revocationRegistries[revocationRegistryDefinitionId]) {
          throw new AnonCredsRsError(`Revocation Registry ${revocationRegistryDefinitionId} not found`)
        }

        const { definition, tailsFilePath } = options.revocationRegistries[revocationRegistryDefinitionId]

        const { revocationRegistryDefinition } = RevocationRegistryDefinition.create({
          credentialDefinition: rsCredentialDefinitions[definition.credDefId],
          credentialDefinitionId: definition.credDefId,
          issuerId: definition.issuerId,
          maximumCredentialNumber: definition.value.maxCredNum,
          originDid: 'origin:uri', // FIXME: Remove from API
          revocationRegistryType: definition.revocDefType,
          tag: definition.tag,
          //tailsDirectoryPath: TODO
        })

        const revocationState = CredentialRevocationState.create({
          revocationRegistryIndex,
          revocationRegistryDefinition,
          tailsPath: tailsFilePath,
          revocationRegistryStatusList: RevocationStatusList.create({
            issuanceByDefault: true,
            revocationRegistryDefinition,
            revocationRegistryDefinitionId,
            timestamp: new Date().getTime() / 1000, //TODO: Should be set?
          }),
        })

        credentials.push({
          credential,
          revocationState,
          timestamp: new Date().getTime() / 1000, // TODO: set proper timestamp value
        })
      }

      if (!linkSecretId) {
        throw new AnonCredsRsError('Link Secret not defined')
      }

      const linkSecretRecord = await agentContext.dependencyManager
        .resolve(AnonCredsLinkSecretRepository)
        .getByLinkSecretId(agentContext, linkSecretId)

      if (!linkSecretRecord.value) {
        throw new AnonCredsRsError('Link Secret value not stored')
      }

      const presentation = Presentation.create({
        credentialDefinitions: rsCredentialDefinitions,
        schemas: rsSchemas,
        presentationRequest: PresentationRequest.load(JSON.stringify(proofRequest)),
        credentials,
        credentialsProve,
        selfAttest: requestedCredentials.selfAttestedAttributes,
        masterSecret: MasterSecret.load(JSON.stringify({ value: { ms: linkSecretRecord.value } })),
      })

      return JSON.parse(presentation.toJson())
    } catch (error) {
      agentContext.config.logger.error(`Error creating AnonCreds Proof`, {
        error,
        proofRequest,
        requestedCredentials,
      })
      throw new AnonCredsRsError('Error creating proof', { cause: error })
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
        // No default link secret: TODO: shall we create a new one?
        throw new AnonCredsRsError('Link Secret not found')
      }

      const { credentialRequest, credentialRequestMetadata } = CredentialRequest.create({
        credentialDefinition: CredentialDefinition.load(JSON.stringify(credentialDefinition)),
        credentialOffer: CredentialOffer.load(JSON.stringify(credentialOffer)),
        masterSecret: MasterSecret.load(JSON.stringify({ value: { ms: linkSecretRecord.value } })),
        masterSecretId: linkSecretRecord.id,
      })

      return {
        credentialRequest: JSON.parse(credentialRequest.toJson()),
        credentialRequestMetadata: JSON.parse(credentialRequestMetadata.toJson()),
      }
    } catch (error) {
      throw new AnonCredsRsError('Error creating credential request', { cause: error })
    }
  }

  public async storeCredential(agentContext: AgentContext, options: StoreCredentialOptions): Promise<string> {
    // TODO
    throw new AnonCredsRsError('Not implemented yet')
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
      // TODO: credentialRevocationId
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
    // TODO
    throw new AnonCredsRsError('Not implemented yet')
  }
}
