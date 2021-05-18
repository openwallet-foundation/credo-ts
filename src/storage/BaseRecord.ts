import { Exclude, Type } from 'class-transformer'

export type Tags = Record<string, string | undefined>

export abstract class BaseRecord {
  @Exclude()
  public id!: string

  @Type(() => Date)
  public createdAt!: Date

  @Type(() => Date)
  public updatedAt?: Date

  @Exclude()
  public tags: Tags = {}

  // Required because Javascript doesn't allow accessing static types
  // like instance.static_member
  public static readonly type: string = 'BaseRecord'

  @Exclude()
  public readonly type = BaseRecord.type
}
