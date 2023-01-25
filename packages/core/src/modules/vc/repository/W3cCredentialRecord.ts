import type { TagsBase } from '../../../storage/BaseRecord'

import { Type } from 'class-transformer'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import { W3cVerifiableCredential } from '../models/credential/W3cVerifiableCredential'

export interface W3cCredentialRecordOptions {
  id?: string
  createdAt?: Date
  credential: W3cVerifiableCredential
  tags: CustomW3cCredentialTags
}

export type CustomW3cCredentialTags = TagsBase & {
  expandedTypes?: Array<string>
}

export type DefaultW3cCredentialTags = {
  issuerId: string
  subjectIds: Array<string>
  schemaIds: Array<string>
  contexts: Array<string>
  proofTypes: Array<string>
  givenId?: string
}

export class W3cCredentialRecord extends BaseRecord<DefaultW3cCredentialTags, CustomW3cCredentialTags> {
  public static readonly type = 'W3cCredentialRecord'
  public readonly type = W3cCredentialRecord.type

  @Type(() => W3cVerifiableCredential)
  public credential!: W3cVerifiableCredential

  public constructor(props: W3cCredentialRecordOptions) {
    super()
    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags
      this.credential = props.credential
    }
  }

  public getTags() {
    // Contexts are usually strings, but can sometimes be objects. We're unable to use objects as tags,
    // so we filter out the objects before setting the tags.
    const stringContexts = this.credential.contexts.filter((ctx) => typeof ctx === 'string') as string[]

    return {
      ...this._tags,
      issuerId: this.credential.issuerId,
      subjectIds: this.credential.credentialSubjectIds,
      schemaIds: this.credential.credentialSchemaIds,
      contexts: stringContexts,
      proofTypes: this.credential.proofTypes,
      givenId: this.credential.id,
    }
  }
}
