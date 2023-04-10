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
  tailsDirectoryPath: string
  maximumCredentialNumber: number
}

export interface AnonCredsRegisterRevocationStatusListOptions {
  issuerId: string
  issuanceByDefault: boolean
  revocationRegistryDefinitionId: string
  tailsLocation: string
}

export interface AnonCredsUpdateRevocationStatusListOptions {
  revokedCredentialIndexes: number[]
  issuedCredentialIndexes: number[]
  revocationRegistryDefinitionId: string
}

export interface AnonCredsRevokeCredentialOptions {
  revocationRegistryDefinitionId: string
  revokedIndexes: number[]
}
