import type { AnonCredsCredentialDefinition } from './models'

export interface AnonCredsCreateLinkSecretOptions {
  linkSecretId?: string
  setAsDefault?: boolean
}

export type AnonCredsRegisterCredentialDefinitionOptions = Omit<AnonCredsCredentialDefinition, 'value' | 'type'>
