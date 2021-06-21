import { Exclude, Type } from 'class-transformer'

export type TagValue = string | boolean | undefined
export type TagsBase = {
  [key: string]: TagValue
  [key: number]: never
}

export type Tags<DefaultTags, CustomTags extends TagsBase> = CustomTags & DefaultTags

export abstract class BaseRecord<DefaultTags = Record<string, unknown>, CustomTags extends TagsBase = TagsBase> {
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
}
