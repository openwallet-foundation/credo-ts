import type { TagsBase } from '../../../storage/BaseRecord'

import { Type } from 'class-transformer'
import { IsEnum, ValidateNested } from 'class-validator'

import { BaseRecord } from '../../../storage/BaseRecord'
import { DidDocument } from '../domain'
import { DidDocumentRole } from '../domain/DidDocumentRole'

export interface DidDocumentRecordProps {
  id: string
  role: DidDocumentRole
  didDocument: DidDocument
  createdAt?: Date
  tags?: CustomDidDocumentTags
}

export type CustomDidDocumentTags = TagsBase

export type DefaultDidDocumentTags = TagsBase

export class DidDocumentRecord
  extends BaseRecord<DefaultDidDocumentTags, CustomDidDocumentTags>
  implements DidDocumentRecordProps
{
  @Type(() => DidDocument)
  @ValidateNested()
  public didDocument!: DidDocument

  @IsEnum(DidDocumentRole)
  public role!: DidDocumentRole

  public static readonly type = 'DidDocumentRecord'
  public readonly type = DidDocumentRecord.type

  public constructor(props: DidDocumentRecordProps) {
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
