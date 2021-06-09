import { Exclude, Type } from 'class-transformer'

export type TagValue = string | boolean | undefined
export type TagsBase = {
  [key: string]: TagValue
  [key: number]: never
}

export type Tags<ComputedTags, CustomTags extends TagsBase> = CustomTags & ComputedTags

// eslint-disable-next-line @typescript-eslint/ban-types
export abstract class BaseRecord<ComputedTags = {}, CustomTags extends TagsBase = TagsBase> {
  @Exclude()
  protected _tags!: CustomTags

  @Exclude()
  public id!: string

  @Type(() => Date)
  public createdAt!: Date

  @Type(() => Date)
  public updatedAt?: Date

  @Exclude()
  public readonly type = BaseRecord.type
  public static readonly type: string = 'BaseRecord'

  /**
   * Get all tags. This is includes custom and computed tags
   * @returns tags object
   */
  public abstract getTags(): Tags<ComputedTags, CustomTags>

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
  public getTag(name: keyof CustomTags) {
    return this._tags[name]
  }

  /**
   * Set all tags. Computed tags will still be added overridden when retrieving tags
   * @param tags the tags to set
   */
  public setTags(tags: CustomTags & Partial<ComputedTags>) {
    this._tags = tags
  }
}
