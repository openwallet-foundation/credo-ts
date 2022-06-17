import type { Attachment } from '../../../../../decorators/attachment/Attachment'

export interface IndyCredentialViewModel {
  metadata?: IndyCredentialViewMetadata | null
  claims: Record<string, string>
  attachments?: Attachment[]
}

export interface IndyCredentialViewMetadata {
  credentialDefinitionId?: string
  schemaId?: string
}

export class IndyCredentialView {
  public constructor(options: IndyCredentialViewModel) {
    this.metadata = options.metadata ?? {}
    this.claims = options.claims
    this.attachments = options.attachments
  }

  public metadata: IndyCredentialViewMetadata
  public claims: Record<string, string>
  public attachments?: Attachment[]
}
