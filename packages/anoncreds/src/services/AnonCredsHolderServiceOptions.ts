import type {
  AnonCredsCredentialInfo,
  AnonCredsCredentialRequestMetadata,
  AnonCredsSelectedCredentials,
} from '../models'
import type {
  AnonCredsCredential,
  AnonCredsCredentialOffer,
  AnonCredsCredentialRequest,
  AnonCredsProofRequest,
  AnonCredsNonRevokedInterval,
} from '../models/exchange'
import type {
  AnonCredsCredentialDefinition,
  AnonCredsRevocationStatusList,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsSchema,
} from '../models/registry'

export interface AnonCredsAttributeInfo {
  name?: string
  names?: string[]
}

export interface CreateProofOptions {
  proofRequest: AnonCredsProofRequest
  selectedCredentials: AnonCredsSelectedCredentials
  schemas: {
    [schemaId: string]: AnonCredsSchema
  }
  credentialDefinitions: {
    [credentialDefinitionId: string]: AnonCredsCredentialDefinition
  }
  revocationRegistries: {
    [revocationRegistryDefinitionId: string]: {
      // tails file MUST already be downloaded on a higher level and stored
      tailsFilePath: string
      definition: AnonCredsRevocationRegistryDefinition
      revocationStatusLists: {
        [timestamp: number]: AnonCredsRevocationStatusList
      }
    }
  }
}

export interface StoreCredentialOptions {
  credentialRequestMetadata: AnonCredsCredentialRequestMetadata
  credential: AnonCredsCredential
  credentialDefinition: AnonCredsCredentialDefinition
  schema: AnonCredsSchema
  credentialDefinitionId: string
  credentialId?: string
  revocationRegistry?: {
    id: string
    definition: AnonCredsRevocationRegistryDefinition
  }
}

export interface GetCredentialOptions {
  credentialId: string
}

// TODO: Maybe we can make this a bit more specific?
export type WalletQuery = Record<string, unknown>
export interface ReferentWalletQuery {
  [referent: string]: WalletQuery
}

export interface GetCredentialsForProofRequestOptions {
  proofRequest: AnonCredsProofRequest
  attributeReferent: string
  start?: number
  limit?: number
  extraQuery?: ReferentWalletQuery
}

export type GetCredentialsForProofRequestReturn = Array<{
  credentialInfo: AnonCredsCredentialInfo
  interval?: AnonCredsNonRevokedInterval
}>

export interface CreateCredentialRequestOptions {
  credentialOffer: AnonCredsCredentialOffer
  credentialDefinition: AnonCredsCredentialDefinition
  linkSecretId?: string
}

export interface CreateCredentialRequestReturn {
  credentialRequest: AnonCredsCredentialRequest
  credentialRequestMetadata: AnonCredsCredentialRequestMetadata
}

export interface CreateLinkSecretOptions {
  linkSecretId?: string
}

export interface CreateLinkSecretReturn {
  linkSecretId: string
  linkSecretValue?: string
}
