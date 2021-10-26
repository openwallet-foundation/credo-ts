export type MetadataBase = {
  [key: string]: Record<string, unknown>
}

/**
 * Metadata access class to get, set (create and update) and delete
 * metadata on any record.
 *
 * set will override the previous value if it already exists
 *
 * note: To add in-memory persistence to these records, you have to
 * update the record in the correct repository
 *
 * @example
 *
 * ```ts
 * connectionRecord.metadata.set('foo', { bar: 'baz' })
 * connectionRepository.update(connectionRecord)
 * ```
 */
export class Metadata {
  public readonly data: MetadataBase

  public constructor(data: MetadataBase) {
    this.data = data
  }

  /**
   * Gets the value by key in the metadata
   *
   * @param key the key to retrieve the metadata by
   * @returns the value saved in the key value pair
   * @returns null when the key could not be found
   */
  public get<T extends Record<string, unknown>>(key: string): T | null {
    return (this.data[key] as T) ?? null
  }

  /**
   * Will set, or override, a key value pair on the metadata
   *
   * @param key the key to set the metadata by
   * @param value the value to set in the metadata
   */
  public set(key: string, value: Record<string, unknown>): void {
    this.data[key] = value
  }

  /**
   * Retrieves all the metadata for a record
   *
   * @returns all the metadata that exists on the record
   */
  public getAll(): MetadataBase {
    return this.data
  }

  /**
   * Will delete the key value pair in the metadata
   *
   * @param key the key to delete the data by
   */
  public delete(key: string): void {
    delete this.data[key]
  }
}
