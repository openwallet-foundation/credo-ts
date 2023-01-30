export interface AnonCredsCredentialInfo {
  credentialId: string
  attributes: {
    [key: string]: string
  }
  schemaId: string
  credentialDefinitionId: string
  revocationRegistryId?: string | undefined
  credentialRevocationId?: string | undefined
}

export interface AnonCredsRequestedAttribute {
  credentialId: string
  timestamp?: number
  revealed: boolean
  credentialInfo: AnonCredsCredentialInfo
  revoked?: boolean
}

export interface AnonCredsRequestedPredicate {
  credentialId: string
  timestamp?: number
  credentialInfo: AnonCredsCredentialInfo
  revoked?: boolean
}

export interface AnonCredsRequestedCredentials {
  requestedAttributes?: Record<string, AnonCredsRequestedAttribute>
  requestedPredicates?: Record<string, AnonCredsRequestedPredicate>
  selfAttestedAttributes: Record<string, string>
}

export interface AnonCredsCredentialRequestMetadata {
  master_secret_blinding_data: {
    v_prime: string
    vr_prime: string | null
  }
  master_secret_name: string
  nonce: string
}
