import type {
  AnonCredsCredential,
  AnonCredsCredentialOffer,
  AnonCredsCredentialRequest,
  AnonCredsCredentialValues,
} from '../models/exchange'
import type {
  AnonCredsCredentialDefinition,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsRevocationStatusList,
  AnonCredsSchema,
} from '../models/registry'

export interface CreateSchemaOptions {
  issuerId: string
  name: string
  version: string
  attrNames: string[]
}

export interface CreateCredentialDefinitionOptions {
  issuerId: string
  tag: string
  supportRevocation?: boolean
  schemaId: string
  schema: AnonCredsSchema
}

export interface CreateRevocationRegistryDefinitionOptions {
  issuerId: string
  tag: string
  credentialDefinitionId: string
  credentialDefinition: AnonCredsCredentialDefinition
  maximumCredentialNumber: number
  tailsDirectoryPath: string
}

export interface CreateRevocationStatusListOptions {
  issuerId: string
  issuanceByDefault: boolean
  revocationRegistryDefinitionId: string
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
}

export interface CreateCredentialOfferOptions {
  credentialDefinitionId: string
}

export interface CreateCredentialOptions {
  credentialOffer: AnonCredsCredentialOffer
  credentialRequest: AnonCredsCredentialRequest
  credentialValues: AnonCredsCredentialValues
  revocationRegistryDefinitionId?: string
  tailsFilePath?: string
  revocationStatusList?: AnonCredsRevocationStatusList
}

export interface CreateCredentialReturn {
  credential: AnonCredsCredential
  credentialRevocationId?: string
}

export interface CreateCredentialDefinitionReturn {
  credentialDefinition: AnonCredsCredentialDefinition
  credentialDefinitionPrivate?: Record<string, unknown>
  keyCorrectnessProof?: Record<string, unknown>
}

export interface CreateRevocationRegistryDefinitionReturn {
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
  revocationRegistryDefinitionPrivate?: Record<string, unknown>
  tailsHash: string
}

export interface CreateRevocationStatusListReturn {
  revocationStatusList: AnonCredsRevocationStatusList
}
