export interface CredentialInfo {
  referent: string
  attributes: {
    [key: string]: string
  }
  schemaId: string
  credentialDefinitionId: string
  revocationRegistryId?: string | undefined
  credentialRevocationId?: string | undefined
}

export interface RequestedAttribute {
  credentialId: string
  timestamp?: number
  revealed: boolean
  credentialInfo: CredentialInfo
  revoked?: boolean
}

export interface RequestedPredicate {
  credentialId: string
  timestamp?: number
  credentialInfo: CredentialInfo
  revoked?: boolean
}

export interface RequestedCredentials {
  requestedAttributes?: Record<string, RequestedAttribute>
  requestedPredicates?: Record<string, RequestedPredicate>
  selfAttestedAttributes: Record<string, string>
}
