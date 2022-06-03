import { Exclude, Transform, TransformationType } from 'class-transformer'

import { JsonTransformer } from '../utils/JsonTransformer'
import { MetadataTransformer } from '../utils/transformers'

import { Metadata } from './Metadata'

export type TagValue = string | boolean | undefined | Array<string>
export type TagsBase = {
  [key: string]: TagValue
  [key: number]: never
}

export type Tags<DefaultTags extends TagsBase, CustomTags extends TagsBase> = CustomTags & DefaultTags

export type RecordTags<Record extends BaseRecord> = ReturnType<Record['getTags']>

export abstract class BaseRecord<
  DefaultTags extends TagsBase = TagsBase,
  CustomTags extends TagsBase = TagsBase,
  MetadataValues = Record<string, unknown>
> {
  protected _tags: CustomTags = {} as CustomTags

  public id!: string

  @Transform(({ value, type }) =>
    type === TransformationType.CLASS_TO_PLAIN ? value.toISOString(value) : new Date(value)
  )
  public createdAt!: Date

  @Transform(({ value, type }) =>
    type === TransformationType.CLASS_TO_PLAIN ? value.toISOString(value) : new Date(value)
  )
  public updatedAt?: Date

  @Exclude()
  public readonly type = BaseRecord.type
  public static readonly type: string = 'BaseRecord'

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
  public setTag(name: keyof CustomTags, value: CustomTags[keyof CustomTags]) {
    this._tags[name] = value
  }

  /**
   * Get the value for a tag
   * @param name name of the tag
   * @returns The tag value, or undefined if not found
   */
  public getTag(name: keyof CustomTags | keyof DefaultTags) {
    return this.getTags()[name]
  }

  /**
   * Set custom tags. This will merge the tags object with passed in tag properties
   *
   * @param tags the tags to set
   */
  public setTags(tags: Partial<CustomTags>) {
    this._tags = {
      ...this._tags,
      ...tags,
    }
  }

  /**
   * Replace tags. This will replace the whole tags object.
   * Default tags will still be overridden when retrieving tags
   *
   * @param tags the tags to set
   */
  public replaceTags(tags: CustomTags & Partial<DefaultTags>) {
    this._tags = tags
  }

  public toJSON(): Record<string, unknown> {
    return JsonTransformer.toJSON(this)
  }
}
