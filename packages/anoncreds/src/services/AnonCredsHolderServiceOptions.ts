import type {
  AnonCredsCredentialInfo,
  AnonCredsCredentialRequestMetadata,
  AnonCredsRequestedCredentials,
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
  AnonCredsRevocationList,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsSchema,
} from '../models/registry'

export interface AnonCredsAttributeInfo {
  name?: string
  names?: string[]
}

export interface CreateProofOptions {
  proofRequest: AnonCredsProofRequest
  requestedCredentials: AnonCredsRequestedCredentials
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
      revocationLists: {
        [timestamp: string]: AnonCredsRevocationList
      }
    }
  }
}

export interface StoreCredentialOptions {
  credentialRequestMetadata: AnonCredsCredentialRequestMetadata
  credential: AnonCredsCredential
  credentialDefinition: AnonCredsCredentialDefinition
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
}

export interface CreateCredentialRequestReturn {
  credentialRequest: AnonCredsCredentialRequest
  credentialRequestMetadata: AnonCredsCredentialRequestMetadata
}
