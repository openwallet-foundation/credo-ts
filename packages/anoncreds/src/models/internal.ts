import type { AnonCredsClaimRecord } from '../utils/credential'
import type { AnonCredsPredicateType } from './exchange'

export interface AnonCredsPresentationPreviewAttribute {
  name: string
  credentialDefinitionId?: string
  mimeType?: string
  value?: string
  referent?: string
}

export interface AnonCredsPresentationPreviewPredicate {
  name: string
  credentialDefinitionId: string
  predicate: AnonCredsPredicateType
  threshold: number
}

/**
 * Interface for getting credentials for an indy proof request.
 */
export interface AnonCredsCredentialsForProofRequest {
  attributes: Record<string, AnonCredsRequestedAttributeMatch[]>
  predicates: Record<string, AnonCredsRequestedPredicateMatch[]>
}

export interface AnonCredsGetCredentialsForProofRequestOptions {
  filterByNonRevocationRequirements?: boolean
}

export interface AnonCredsCredentialInfo {
  credentialId: string
  attributes: AnonCredsClaimRecord
  schemaId: string
  credentialDefinitionId: string
  revocationRegistryId: string | null
  credentialRevocationId: string | null
  methodName: string
  createdAt: Date
  updatedAt: Date
  linkSecretId: string
}

export interface AnonCredsRequestedAttributeMatch {
  credentialId: string
  timestamp?: number
  revealed: boolean
  credentialInfo: AnonCredsCredentialInfo
  revoked?: boolean
}

export interface AnonCredsRequestedPredicateMatch {
  credentialId: string
  timestamp?: number
  credentialInfo: AnonCredsCredentialInfo
  revoked?: boolean
}

export interface AnonCredsSelectedCredentials {
  attributes: Record<string, AnonCredsRequestedAttributeMatch>
  predicates: Record<string, AnonCredsRequestedPredicateMatch>
  selfAttestedAttributes: Record<string, string>
}

export interface AnonCredsLinkSecretBlindingData {
  v_prime: string
  vr_prime: string | null
}
