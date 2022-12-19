import type { AnonCredsCredentialOffer } from '../models/exchange'
import type { AnonCredsCredentialDefinition, AnonCredsSchema } from '../models/vdr'
import type {
  CreateSchemaOptions,
  CreateCredentialDefinitionOptions,
  CreateCredentialOfferOptions,
  CreateCredentialReturn,
  CreateCredentialOptions,
} from './AnonCredsIssuerServiceOptions'
import type { AgentContext } from '@aries-framework/core'

export interface AnonCredsIssuerService {
  createSchema(agentContext: AgentContext, options: CreateSchemaOptions): Promise<AnonCredsSchema>

  // This should store the private part of the credential definition as in the indy-sdk
  // we don't have access to the private part of the credential definition
  createCredentialDefinition(
    agentContext: AgentContext,
    options: CreateCredentialDefinitionOptions,
    metadata?: Record<string, unknown>
  ): Promise<AnonCredsCredentialDefinition>

  createCredentialOffer(
    agentContext: AgentContext,
    options: CreateCredentialOfferOptions
  ): Promise<AnonCredsCredentialOffer>

  createCredential(agentContext: AgentContext, options: CreateCredentialOptions): Promise<CreateCredentialReturn>
}
