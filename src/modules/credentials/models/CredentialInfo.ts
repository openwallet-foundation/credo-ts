export interface CredentialInfoOptions {
  metadata?: IndyCredentialMetadata
  claims: Record<string, string>
}

export interface IndyCredentialMetadata {
  credentialDefinitionId?: string
  schemaId?: string
}

export class CredentialInfo {
  public constructor(options: CredentialInfoOptions) {
    this.metadata = options.metadata ?? {}
    this.claims = options.claims
  }

  public metadata: IndyCredentialMetadata
  public claims: Record<string, string>
}
