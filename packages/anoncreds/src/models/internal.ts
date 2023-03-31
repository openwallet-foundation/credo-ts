export interface AnonCredsCredentialInfo {
  credentialId: string
  attributes: {
    [key: string]: string
  }
  schemaId: string
  credentialDefinitionId: string
  revocationRegistryId?: string | undefined
  credentialRevocationId?: string | undefined
  methodName: string
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

export interface AnonCredsCredentialRequestMetadata {
  link_secret_blinding_data: AnonCredsLinkSecretBlindingData
  link_secret_name: string
  nonce: string
}
