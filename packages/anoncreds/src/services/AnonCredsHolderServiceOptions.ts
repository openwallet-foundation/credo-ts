import { CredentialInfo, RequestedCredentials } from '../models'

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
} from '../models/vdr'

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
  revocationStates: {
    [revocationRegistryDefinitionId: string]: {
      definition: AnonCredsRevocationRegistryDefinition
      revocationLists: {
        [timestamp: string]: AnonCredsRevocationList
      }
    }
  }
}

export type CreateProofMetadata = {
  schemasMetaData: { [key: string]: { seqNo: number; ver: string } }
  credentialDefinitionsMetaData: { [key: string]: { ver: string } }
}

export interface StoreCredentialOptions {
  // TODO: what is in credential request metadata?
  credentialRequestMetadata: Record<string, unknown>
  credential: AnonCredsCredential
  credentialDefinition: AnonCredsCredentialDefinition
  credentialId?: string
  revocationRegistryDefinition?: AnonCredsRevocationRegistryDefinition
}
export type StoreCredentialMetadata = {
  credentialDefinitionMetadata: {
    id: string
    ver: string
  }
  revocationRegistryDefinition: {
    id: string
    issuanceType: 'ISSUANCE_BY_DEFAULT' | 'ISSUANCE_ON_DEMAND'
    ver: string
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


export interface GetCredentialsForProofRequestReturn {
  credentialInfo: CredentialInfo
  interval?: NonRevokedInterval
}

export interface CreateCredentialRequestOptions {
  // TODO: Why is this needed? It is just used as context in Ursa, can be any string. Should we remove it?
  // Should we not make it did related? (related to comment in AnonCredsCredentialRequest)
  holderDid: string
  credentialOffer: AnonCredsCredentialOffer
  credentialDefinition: AnonCredsCredentialDefinition
}

export type CreateCredentialRequestMetadata = {
  id: string
  ver: string
}

export interface CreateCredentialRequestReturn {
  credentialRequest: AnonCredsCredentialRequest
  credentialRequestMetadata: Record<string, unknown>
}
