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
  CreateCredentialDefinitionReturn,
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'

import { injectable, AriesFrameworkError, inject } from '@aries-framework/core'

import { IndySdkError, isIndyError } from '../../error'
import { IndySdk, IndySdkSymbol } from '../../types'
import { assertIndySdkWallet } from '../../utils/assertIndySdkWallet'
import { generateLegacyProverDidLikeString } from '../utils/proverDid'
import { createTailsReader } from '../utils/tails'
import { indySdkSchemaFromAnonCreds } from '../utils/transform'

@injectable()
export class IndySdkIssuerService implements AnonCredsIssuerService {
  private indySdk: IndySdk

  public constructor(@inject(IndySdkSymbol) indySdk: IndySdk) {
    this.indySdk = indySdk
  }

  public async createSchema(agentContext: AgentContext, options: CreateSchemaOptions): Promise<AnonCredsSchema> {
    const { issuerId, name, version, attrNames } = options
    assertIndySdkWallet(agentContext.wallet)

    try {
      const [, schema] = await this.indySdk.issuerCreateSchema(issuerId, name, version, attrNames)

      return {
        issuerId,
        attrNames: schema.attrNames,
        name: schema.name,
        version: schema.version,
      }
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async createCredentialDefinition(
    agentContext: AgentContext,
    options: CreateCredentialDefinitionOptions,
    metadata?: CreateCredentialDefinitionMetadata
  ): Promise<CreateCredentialDefinitionReturn> {
    const { tag, supportRevocation, schema, issuerId, schemaId } = options

    if (!metadata)
      throw new AriesFrameworkError('The metadata parameter is required when using Indy, but received undefined.')

    try {
      assertIndySdkWallet(agentContext.wallet)
      const [, credentialDefinition] = await this.indySdk.issuerCreateAndStoreCredentialDef(
        agentContext.wallet.handle,
        issuerId,
        indySdkSchemaFromAnonCreds(schemaId, schema, metadata.indyLedgerSchemaSeqNo),
        tag,
        'CL',
        {
          support_revocation: supportRevocation,
        }
      )

      return {
        credentialDefinition: {
          issuerId,
          tag: credentialDefinition.tag,
          schemaId,
          type: 'CL',
          value: credentialDefinition.value,
        },
      }
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async createCredentialOffer(
    agentContext: AgentContext,
    options: CreateCredentialOfferOptions
  ): Promise<AnonCredsCredentialOffer> {
    assertIndySdkWallet(agentContext.wallet)
    try {
      return await this.indySdk.issuerCreateCredentialOffer(agentContext.wallet.handle, options.credentialDefinitionId)
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async createCredential(
    agentContext: AgentContext,
    options: CreateCredentialOptions
  ): Promise<CreateCredentialReturn> {
    const { tailsFilePath, credentialOffer, credentialRequest, credentialValues, revocationRegistryId } = options

    assertIndySdkWallet(agentContext.wallet)
    try {
      // Indy SDK requires tailsReaderHandle. Use null if no tailsFilePath is present
      const tailsReaderHandle = tailsFilePath ? await createTailsReader(agentContext, tailsFilePath) : 0

      if (revocationRegistryId || tailsFilePath) {
        throw new AriesFrameworkError('Revocation not supported yet')
      }

      // prover_did is deprecated and thus if not provided we generate something on our side, as it's still required by the indy sdk
      const proverDid = credentialRequest.prover_did ?? generateLegacyProverDidLikeString()

      const [credential, credentialRevocationId] = await this.indySdk.issuerCreateCredential(
        agentContext.wallet.handle,
        credentialOffer,
        { ...credentialRequest, prover_did: proverDid },
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
