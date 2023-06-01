export interface AnonCredsCreateLinkSecretOptions {
  linkSecretId?: string
  setAsDefault?: boolean
}

export interface AnonCredsRegisterCredentialDefinitionOptions {
  issuerId: string
  schemaId: string
  tag: string
}

export interface AnonCredsRegisterRevocationRegistryDefinitionOptions {
  issuerId: string
  tag: string
  credentialDefinitionId: string
  maximumCredentialNumber: number
}

export interface AnonCredsRegisterRevocationStatusListOptions {
  issuerId: string
  revocationRegistryDefinitionId: string
}

export interface AnonCredsUpdateRevocationStatusListOptions {
  revokedCredentialIndexes?: number[]
  issuedCredentialIndexes?: number[]
  revocationRegistryDefinitionId: string
}
