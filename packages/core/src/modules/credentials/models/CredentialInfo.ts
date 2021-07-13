import type { Attachment } from '../../../decorators/attachment/Attachment'

export interface CredentialInfoOptions {
  metadata?: IndyCredentialMetadata
  claims: Record<string, string>
  attachments?: Attachment[]
}

export interface IndyCredentialMetadata {
  credentialDefinitionId?: string
  schemaId?: string
}

export class CredentialInfo {
  public constructor(options: CredentialInfoOptions) {
    this.metadata = options.metadata ?? {}
    this.claims = options.claims
    this.attachments = options.attachments
  }

  public metadata: IndyCredentialMetadata
  public claims: Record<string, string>
  public attachments?: Attachment[]
}
