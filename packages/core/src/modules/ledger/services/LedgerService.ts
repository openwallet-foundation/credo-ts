import type { default as Indy, CredDef, NymRole, Schema, GetNymResponse } from 'indy-sdk'

export interface LedgerService {
  connectToPools(): Promise<number[] | void>
  registerPublicDid(
    submitterDid: string,
    targetDid: string,
    verkey: string,
    alias: string,
    role?: NymRole
  ): Promise<string>
  getPublicDid(did: string): Promise<GetNymResponse>
  getEndpointsForDid(did: string): Promise<IndyEndpointAttrib>
  registerSchema(did: string, schemaTemplate: SchemaTemplate): Promise<Schema>
  getSchema(schemaId: string): Promise<Schema>
  registerCredentialDefinition(
    did: string,
    credentialDefinitionTemplate: CredentialDefinitionTemplate
  ): Promise<CredDef>
  getCredentialDefinition(credentialDefinitionId: string): Promise<CredDef>
  getRevocationRegistryDefinition(
    revocationRegistryDefinitionId: string
  ): Promise<ParseRevocationRegistryDefinitionTemplate>
  getRevocationRegistryDelta(
    revocationRegistryDefinitionId: string,
    from?: number,
    to?: number
  ): Promise<ParseRevocationRegistryDeltaTemplate>
  getRevocationRegistry(
    revocationRegistryDefinitionId: string,
    timestamp: number
  ): Promise<ParseRevocationRegistryTemplate>
}

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
