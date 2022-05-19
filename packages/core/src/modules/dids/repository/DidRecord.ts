import type { TagsBase } from '../../../storage/BaseRecord'

import { Type } from 'class-transformer'
import { IsEnum, ValidateNested } from 'class-validator'

import { BaseRecord } from '../../../storage/BaseRecord'
import { DidDocument } from '../domain'
import { DidDocumentRole } from '../domain/DidDocumentRole'
import { parseDid } from '../domain/parse'

export interface DidRecordProps {
  id: string
  role: DidDocumentRole
  didDocument?: DidDocument
  createdAt?: Date
  tags?: CustomDidTags
}

interface CustomDidTags extends TagsBase {
  recipientKeyFingerprints?: string[]
}

type DefaultDidTags = {
  role: DidDocumentRole
  method: string
}

export class DidRecord extends BaseRecord<DefaultDidTags, CustomDidTags> implements DidRecordProps {
  @Type(() => DidDocument)
  @ValidateNested()
  public didDocument?: DidDocument

  @IsEnum(DidDocumentRole)
  public role!: DidDocumentRole

  public static readonly type = 'DidDocumentRecord'
  public readonly type = DidRecord.type

  public constructor(props: DidRecordProps) {
    super()

    if (props) {
      this.id = props.id
      this.role = props.role
      this.didDocument = props.didDocument
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    const did = parseDid(this.id)

    return {
      ...this._tags,
      role: this.role,
      method: did.method,
    }
  }
}
