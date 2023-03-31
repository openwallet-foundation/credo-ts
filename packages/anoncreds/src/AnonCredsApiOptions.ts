import type { AnonCredsCredentialDefinition, AnonCredsRevocationRegistryDefinition } from './models'

export interface AnonCredsCreateLinkSecretOptions {
  linkSecretId?: string
  setAsDefault?: boolean
}

export interface AnonCredsRegisterCredentialDefinitionOptions {
  issuerId: string
  schemaId: string
  tag?: string
  supportRevocation?: boolean
}

export interface AnonCredsRegisterRevocationRegistryDefinitionOptions {
  issuerId: string
  tag: string
  credentialDefinitionId: string
  credentialDefinition: AnonCredsCredentialDefinition
  tailsDirectoryPath: string
  maximumCredentialNumber: number
}

export interface AnonCredsRegisterRevocationStatusListOptions {
  issuerId: string
  issuanceByDefault: true
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
  revocationRegistryDefinitionId: string
}
