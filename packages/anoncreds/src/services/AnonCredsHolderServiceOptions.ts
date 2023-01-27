import type { CredentialInfo, RequestedCredentials } from '../models'
import type {
  AnonCredsCredential,
  AnonCredsCredentialOffer,
  AnonCredsCredentialRequest,
  AnonCredsProofRequest,
  NonRevokedInterval,
  ReferentWalletQuery,
} from '../models/exchange'
import type {
  AnonCredsCredentialDefinition,
  AnonCredsRevocationList,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsSchema,
} from '../models/registry'

export interface AttributeInfo {
  name?: string
  names?: string[]
}

export interface CreateProofOptions {
  proofRequest: AnonCredsProofRequest
  requestedCredentials: RequestedCredentials
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
  // TODO: what is in credential request metadata?
  credentialRequestMetadata: Record<string, unknown>
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

export interface GetCredentialsForProofRequestOptions {
  proofRequest: AnonCredsProofRequest
  attributeReferent: string
  start?: number
  limit?: number
  extraQuery?: ReferentWalletQuery
}

export type GetCredentialsForProofRequestReturn = Array<{
  credentialInfo: CredentialInfo
  interval?: NonRevokedInterval
}>

export interface CreateCredentialRequestOptions {
  // TODO: Why is this needed? It is just used as context in Ursa, can be any string. Should we remove it?
  // Should we not make it did related? (related to comment in AnonCredsCredentialRequest)
  holderDid: string
  credentialOffer: AnonCredsCredentialOffer
  credentialDefinition: AnonCredsCredentialDefinition
}

export interface CreateCredentialRequestReturn {
  credentialRequest: AnonCredsCredentialRequest
  credentialRequestMetadata: Record<string, unknown>
}
