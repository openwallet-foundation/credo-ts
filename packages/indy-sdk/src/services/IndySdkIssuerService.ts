import type { CreateCredentialDefinitionMetadata } from './IndySdkIssuerServiceMetadata'
import type {
  AnonCredsIssuerService,
  CreateCredentialDefinitionOptions,
  CreateCredentialOfferOptions,
  CreateCredentialOptions,
  CreateCredentialReturn,
  CreateSchemaOptions,
  AnonCredsCredentialOffer,
  AnonCredsSchema,
  AnonCredsCredentialDefinition,
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'
import type Indy from 'indy-sdk'

import { AriesFrameworkError, inject, InjectionSymbols, AgentDependencies } from '@aries-framework/core'

import { IndySdkError, isIndyError } from '../error'
import { IndyUtilitiesService } from '../services/IndyUtilitiesService'
import { assertIndyWallet } from '../wallet/assertIndyWallet'

export class IndySdkIssuerService implements AnonCredsIssuerService {
  private indy: typeof Indy
  private indyUtilitiesService: IndyUtilitiesService

  public constructor(
    indyUtilitiesService: IndyUtilitiesService,
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies
  ) {
    this.indy = agentDependencies.indy
    this.indyUtilitiesService = indyUtilitiesService
  }

  public async createSchema(agentContext: AgentContext, options: CreateSchemaOptions): Promise<AnonCredsSchema> {
    const { issuerId, name, version, attrNames } = options
    assertIndyWallet(agentContext.wallet)

    try {
      const [, schema] = await this.indy.issuerCreateSchema(issuerId, name, version, attrNames)

      return schema
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }
  public async createCredentialDefinition(
    agentContext: AgentContext,
    options: CreateCredentialDefinitionOptions,
    metadata?: CreateCredentialDefinitionMetadata
  ): Promise<AnonCredsCredentialDefinition> {
    const { tag, supportRevocation, schema, issuerId } = options

    if (!metadata)
      throw new AriesFrameworkError('The metadata parameter is required when using Indy, but received undefined.')

    try {
      assertIndyWallet(agentContext.wallet)
      const [, credentialDefinition] = await this.indy.issuerCreateAndStoreCredentialDef(
        agentContext.wallet.handle,
        issuerId,
        {
          id: schema.id,
          name: schema.value.name,
          version: schema.value.version,
          attrNames: schema.value.attrNames,
          seqNo: metadata.seqNo,
          ver: '1.0',
        },
        tag,
        'CL',
        {
          support_revocation: supportRevocation,
        }
      )

      return {
        tag: credentialDefinition.tag,
        schemaId: credentialDefinition.schemaId,
        type: 'CL',
        value: credentialDefinition.value,
      }
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }
  public async createCredentialOffer(
    agentContext: AgentContext,
    options: CreateCredentialOfferOptions
  ): Promise<AnonCredsCredentialOffer> {
    assertIndyWallet(agentContext.wallet)
    try {
      return await this.indy.issuerCreateCredentialOffer(agentContext.wallet.handle, options.credentialDefinitionId)
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }
  public async createCredential(
    agentContext: AgentContext,
    options: CreateCredentialOptions
  ): Promise<CreateCredentialReturn> {
    const { tailsFilePath, credentialOffer, credentialRequest, credentialValues, revocationRegistryId } = options

    assertIndyWallet(agentContext.wallet)
    try {
      // Indy SDK requires tailsReaderHandle. Use null if no tailsFilePath is present
      const tailsReaderHandle = tailsFilePath ? await this.indyUtilitiesService.createTailsReader(tailsFilePath) : 0

      if (revocationRegistryId || tailsFilePath) {
        throw new AriesFrameworkError('Revocation not supported yet')
      }

      const [credential, credentialRevocationId] = await this.indy.issuerCreateCredential(
        agentContext.wallet.handle,
        credentialOffer,
        credentialRequest,
        credentialValues,
        revocationRegistryId ?? null,
        tailsReaderHandle
      )

      return {
        credential,
        credentialRevocationId,
      }
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }
}
