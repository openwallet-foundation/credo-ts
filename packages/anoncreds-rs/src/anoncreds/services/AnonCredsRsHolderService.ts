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
  CreateMasterSecretOptions,
  CreateMasterSecretReturn,
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'
import type { CredentialEntry, CredentialProve } from '@hyperledger/anoncreds-shared'

import { AnonCredsMasterSecretRepository } from '@aries-framework/anoncreds'
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

import { uuid } from '../../../../core/src/utils/uuid'
import { AnonCredsRsError } from '../../errors/AnonCredsRsError'
import { AnonCredsCredentialRepository } from '../repository/AnonCredsCredentialRepository'

export class AnonCredsRsHolderService implements AnonCredsHolderService {
  public async createMasterSecret(
    agentContext: AgentContext,
    options: CreateMasterSecretOptions
  ): Promise<CreateMasterSecretReturn> {
    try {
      return {
        masterSecretId: options.masterSecretId ?? uuid(),
        masterSecretValue: JSON.parse(MasterSecret.create().toJson()).value.ms,
      }
    } catch (error) {
      agentContext.config.logger.error(`Error creating Master Secret`, {
        error,
      })
      throw new AnonCredsRsError('Error creating Master Secret', { cause: error })
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

      // Get all requested credentials and take masterSecret. If it's not the same for every credential, throw error
      let masterSecretId
      for (const credentialId of credentialIds) {
        const credentialRecord = await credentialRepository.getByCredentialId(agentContext, credentialId)

        const credential = Credential.load(JSON.stringify(credentialRecord.credential))
        const revocationRegistryDefinitionId = credential.revocationRegistryId

        if (!masterSecretId) {
          masterSecretId = credentialRecord.masterSecretId
        } else {
          if (masterSecretId !== credentialRecord.masterSecretId) {
            throw new AnonCredsRsError(
              'All credentials in a Proof should have been issued using the same Master Secret'
            )
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

      if (!masterSecretId) {
        throw new AnonCredsRsError('Master Secret not defined')
      }

      const masterSecretRecord = await agentContext.dependencyManager
        .resolve(AnonCredsMasterSecretRepository)
        .getByMasterSecretId(agentContext, masterSecretId)

      if (!masterSecretRecord.value) {
        throw new AnonCredsRsError('Master Secret value not stored')
      }

      const presentation = Presentation.create({
        credentialDefinitions: rsCredentialDefinitions,
        schemas: rsSchemas,
        presentationRequest: PresentationRequest.load(JSON.stringify(proofRequest)),
        credentials,
        credentialsProve,
        selfAttest: requestedCredentials.selfAttestedAttributes,
        masterSecret: MasterSecret.load(JSON.stringify({ value: { ms: masterSecretRecord.value } })),
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
      const masterSecretRepository = agentContext.dependencyManager.resolve(AnonCredsMasterSecretRepository)

      // If a master secret is specified, use it. Otherwise, attempt to use default master secret
      const masterSecretRecord = options.masterSecretId
        ? await masterSecretRepository.getByMasterSecretId(agentContext, options.masterSecretId)
        : await masterSecretRepository.findDefault(agentContext)

      if (!masterSecretRecord) {
        // No default master secret: TODO: shall we create a new one?
        throw new AnonCredsRsError('Master Secret not found')
      }

      const { credentialRequest, credentialRequestMetadata } = CredentialRequest.create({
        credentialDefinition: CredentialDefinition.load(JSON.stringify(credentialDefinition)),
        credentialOffer: CredentialOffer.load(JSON.stringify(credentialOffer)),
        masterSecret: MasterSecret.load(JSON.stringify({ value: { ms: masterSecretRecord.value } })),
        masterSecretId: masterSecretRecord.id,
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
