import type {
  GetCredentialDefinitionReturn,
  GetRevocationRegistryDefinitionReturn,
  GetRevocationStatusListReturn,
  GetSchemaReturn,
  RegisterCredentialDefinitionOptions,
  RegisterCredentialDefinitionReturn,
  RegisterRevocationRegistryDefinitionOptions,
  RegisterRevocationRegistryDefinitionReturn,
  RegisterRevocationStatusListOptions,
  RegisterRevocationStatusListReturn,
  RegisterSchemaOptions,
  RegisterSchemaReturn,
} from '@credo-ts/anoncreds'
import { type AgentContext, DidRepository, injectable, Kms } from '@credo-ts/core'
import { HederaAnoncredsRegistry } from '@hiero-did-sdk/anoncreds'
import { LRUMemoryCache } from '@hiero-did-sdk/cache'
import { type Cache, DID_ROOT_KEY_ID } from '@hiero-did-sdk/core'
import { HederaModuleConfig } from '../HederaModuleConfig'
import { KmsSigner } from '../ledger/signer/KmsSigner'
import { createOrGetKey } from '../ledger/utils'

@injectable()
export class HederaAnonCredsService {
  private readonly cache: Cache

  public constructor(private readonly config: HederaModuleConfig) {
    this.cache = config.options.cache ?? new LRUMemoryCache(50)
  }

  public getSchema(_agentContext: AgentContext, schemaId: string): Promise<GetSchemaReturn> {
    return this.getRegistry().getSchema(schemaId)
  }

  public async registerSchema(
    agentContext: AgentContext,
    options: RegisterSchemaOptions
  ): Promise<RegisterSchemaReturn> {
    const issuerKeySigner = await this.getIssuerKeySigner(agentContext, options.schema.issuerId)
    return this.getRegistry().registerSchema({ ...options, issuerKeySigner })
  }

  public getCredentialDefinition(
    _agentContext: AgentContext,
    credentialDefinitionId: string
  ): Promise<GetCredentialDefinitionReturn> {
    return this.getRegistry().getCredentialDefinition(credentialDefinitionId)
  }

  public async registerCredentialDefinition(
    agentContext: AgentContext,
    options: RegisterCredentialDefinitionOptions
  ): Promise<RegisterCredentialDefinitionReturn> {
    const issuerKeySigner = await this.getIssuerKeySigner(agentContext, options.credentialDefinition.issuerId)
    return this.getRegistry().registerCredentialDefinition({
      ...options,
      issuerKeySigner,
      options: {
        supportRevocation: !!options.options?.supportRevocation,
      },
    })
  }

  public getRevocationRegistryDefinition(
    _agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ): Promise<GetRevocationRegistryDefinitionReturn> {
    return this.getRegistry().getRevocationRegistryDefinition(revocationRegistryDefinitionId)
  }

  public async registerRevocationRegistryDefinition(
    agentContext: AgentContext,
    options: RegisterRevocationRegistryDefinitionOptions
  ): Promise<RegisterRevocationRegistryDefinitionReturn> {
    const issuerKeySigner = await this.getIssuerKeySigner(agentContext, options.revocationRegistryDefinition.issuerId)
    return this.getRegistry().registerRevocationRegistryDefinition({
      ...options,
      issuerKeySigner,
    })
  }

  public getRevocationStatusList(
    _agentContext: AgentContext,
    revocationRegistryId: string,
    timestamp: number
  ): Promise<GetRevocationStatusListReturn> {
    return this.getRegistry().getRevocationStatusList(revocationRegistryId, timestamp)
  }

  public async registerRevocationStatusList(
    agentContext: AgentContext,
    options: RegisterRevocationStatusListOptions
  ): Promise<RegisterRevocationStatusListReturn> {
    const issuerKeySigner = await this.getIssuerKeySigner(agentContext, options.revocationStatusList.issuerId)
    return this.getRegistry().registerRevocationStatusList({
      ...options,
      issuerKeySigner,
    })
  }

  private getRegistry(): HederaAnoncredsRegistry {
    return new HederaAnoncredsRegistry({ ...this.config.options, cache: this.cache })
  }

  private async getIssuerKeySigner(agentContext: AgentContext, issuerId: string): Promise<KmsSigner> {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

    const didRecord = await didRepository.findCreatedDid(agentContext, issuerId)
    const rootKey = didRecord?.keys?.find((key) => key.didDocumentRelativeKeyId === DID_ROOT_KEY_ID)
    if (!rootKey?.kmsKeyId) {
      throw new Error('The root key not found in the KMS')
    }

    const issuerPublicJwk = await createOrGetKey(kms, rootKey.kmsKeyId)
    return new KmsSigner(kms, issuerPublicJwk)
  }
}
