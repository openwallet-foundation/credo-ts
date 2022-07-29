import type { AgentContext } from '../../../agent'
import type { IndyPoolConfig } from '../services/indy'
import type { default as Indy, CredDef, NymRole, Schema, GetNymResponse } from 'indy-sdk'

export interface LedgerService {
  setPools(poolConfigs: PoolConfig[]): void
  connectToPools(): Promise<number[] | void>
  registerPublicDid(
    agentContext: AgentContext,
    submitterDid: string,
    targetDid: string,
    verkey: string,
    alias: string,
    role?: NymRole
  ): Promise<string>
  getPublicDid(agentContext: AgentContext, did: string): Promise<GetNymResponse>
  getEndpointsForDid(agentContext: AgentContext, did: string): Promise<IndyEndpointAttrib>
  registerSchema(agentContext: AgentContext, did: string, schemaTemplate: SchemaTemplate): Promise<Schema>
  getSchema(agentContext: AgentContext, schemaId: string): Promise<Schema>
  registerCredentialDefinition(
    agentContext: AgentContext,
    did: string,
    credentialDefinitionTemplate: CredentialDefinitionTemplate
  ): Promise<CredDef>
  getCredentialDefinition(agentContext: AgentContext, credentialDefinitionId: string): Promise<CredDef>
  getRevocationRegistryDefinition(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ): Promise<ParseRevocationRegistryDefinitionTemplate>
  getRevocationRegistryDelta(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string,
    from?: number,
    to?: number
  ): Promise<ParseRevocationRegistryDeltaTemplate>
  getRevocationRegistry(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string,
    timestamp: number
  ): Promise<ParseRevocationRegistryTemplate>
}

export type PoolConfig = IndyPoolConfig

export interface SchemaTemplate {
  name: string
  version: string
  attributes: string[]
}

export interface CredentialDefinitionTemplate {
  schema: Schema
  tag: string
  signatureType: 'CL'
  supportRevocation: boolean
}

export interface ParseRevocationRegistryDefinitionTemplate {
  revocationRegistryDefinition: Indy.RevocRegDef
  revocationRegistryDefinitionTxnTime: number
}

export interface ParseRevocationRegistryDeltaTemplate {
  revocationRegistryDelta: Indy.RevocRegDelta
  deltaTimestamp: number
}

export interface ParseRevocationRegistryTemplate {
  revocationRegistry: Indy.RevocReg
  ledgerTimestamp: number
}

export interface IndyEndpointAttrib {
  endpoint?: string
  types?: Array<'endpoint' | 'did-communication' | 'DIDComm'>
  routingKeys?: string[]
  [key: string]: unknown
}
