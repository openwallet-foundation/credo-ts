import { Exclude } from 'class-transformer'

import { JsonTransformer } from '../utils/JsonTransformer'
import { DateTransformer, MetadataTransformer } from '../utils/transformers'

import { Metadata } from './Metadata'

export type TagValue = string | boolean | undefined | Array<string> | null
export type TagsBase = {
  [key: string]: TagValue
  [key: number]: never
}

export type Tags<DefaultTags extends TagsBase, CustomTags extends TagsBase> = CustomTags & DefaultTags

export type RecordTags<Record extends BaseRecord> = ReturnType<Record['getTags']>

// The BaseRecord requires a DefaultTags and CustomTags type, but we want to be
// able to use the BaseRecord without specifying these types. If we don't specify
// these types, the default TagsBase will be used, but this is not compatible
// with records that have specified a custom type.
// biome-ignore lint/suspicious/noExplicitAny: no explanation
export type BaseRecordAny = BaseRecord<any, any, any>

export abstract class BaseRecord<
  DefaultTags extends TagsBase = TagsBase,
  CustomTags extends TagsBase = TagsBase,
  // We want an empty object, as Record<string, unknown> will make typescript
  // not infer the types correctly
  // biome-ignore lint/complexity/noBannedTypes: no explanation
  MetadataValues = {},
> {
  protected _tags: CustomTags & TagsBase = {} as CustomTags & TagsBase

  public id!: string

  @DateTransformer()
  public createdAt!: Date

  @DateTransformer()
  public updatedAt?: Date

  @Exclude()
  public readonly type = BaseRecord.type
  public static readonly type: string = 'BaseRecord'

  @Exclude()
  public readonly allowCache = BaseRecord.allowCache
  public static readonly allowCache: boolean = false

  /** @inheritdoc {Metadata#Metadata} */
  @MetadataTransformer()
  public metadata: Metadata<MetadataValues> = new Metadata({})

  /**
   * Get all tags. This is includes custom and default tags
   * @returns tags object
   */
  public abstract getTags(): Tags<DefaultTags, CustomTags>

  /**
   * Set the value for a tag
   * @param name name of the tag
   * @param value value of the tag
   */
  public setTag(name: keyof CustomTags | (string & {}), value: CustomTags[keyof CustomTags]) {
    this._tags[name] = value as (typeof this._tags)[string]
  }

  /**
   * Get the value for a tag
   * @param name name of the tag
   * @returns The tag value, or undefined if not found
   */
  public getTag(name: keyof CustomTags | keyof DefaultTags | (string & {})) {
    return this.getTags()[name]
  }

  /**
   * Set custom tags. This will merge the tags object with passed in tag properties
   *
   * @param tags the tags to set
   */
  public setTags(tags: Partial<CustomTags | TagsBase>) {
    this._tags = {
      ...this._tags,
      ...tags,
    } as typeof this._tags
  }

  /**
   * Replace tags. This will replace the whole tags object.
   * Default tags will still be overridden when retrieving tags
   *
   * @param tags the tags to set
   */
  public replaceTags(tags: CustomTags & Partial<TagsBase>) {
    this._tags = tags
  }

  public toJSON(): Record<string, unknown> {
    return JsonTransformer.toJSON(this)
  }

  /**
   * Clones the record.
   */
  public clone() {
    return JsonTransformer.clone(this)
  }
}
