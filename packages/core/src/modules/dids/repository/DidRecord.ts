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
  isPublic?: boolean
  createdAt?: Date
  tags?: CustomDidTags
}

interface CustomDidTags extends TagsBase {
  recipientKeys?: string[]
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

  public isPublic!: boolean

  public static readonly type = 'DidDocumentRecord'
  public readonly type = DidRecord.type

  public constructor(props: DidRecordProps) {
    super()

    if (props) {
      this.id = props.id
      this.role = props.role
      this.didDocument = props.didDocument
      this.isPublic = props.isPublic || false
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    const did = parseDid(this.id)

    return {
      ...this._tags,
      role: this.role,
      isPublic: this.isPublic,
      method: did.method,
    }
  }
}
