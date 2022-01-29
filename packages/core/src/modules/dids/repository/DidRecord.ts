import type { TagsBase } from '../../../storage/BaseRecord'

import { Type } from 'class-transformer'
import { IsEnum, ValidateNested } from 'class-validator'

import { BaseRecord } from '../../../storage/BaseRecord'
import { DidDocument } from '../domain'
import { DidDocumentRole } from '../domain/DidDocumentRole'

export interface DidRecordProps {
  id: string
  role: DidDocumentRole
  didDocument?: DidDocument
  createdAt?: Date
  tags?: CustomDidTags
}

interface CustomDidTags extends TagsBase {
  recipientKeys?: string[]
}

export type DefaultDidTags = TagsBase

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
    }
  }

  public getTags() {
    return {
      ...this._tags,
    }
  }
}
