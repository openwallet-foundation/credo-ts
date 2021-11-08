import { classToPlain, deserialize, plainToClass, serialize } from 'class-transformer'

export class JsonTransformer {
  public static toJSON<T>(classInstance: T) {
    return classToPlain(classInstance, {
      exposeDefaultValues: true,
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static fromJSON<T>(json: any, Class: { new (...args: any[]): T }): T {
    return plainToClass(Class, json, { exposeDefaultValues: true })
  }

  public static serialize<T>(classInstance: T): string {
    return serialize(classInstance, {
      exposeDefaultValues: true,
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static deserialize<T>(jsonString: string, Class: { new (...args: any[]): T }): T {
    return deserialize(Class, jsonString, { exposeDefaultValues: true })
  }

  /**
   * replaces a key in an object
   * These generics are inferred, do not pass them in.
   */
  public static renameKey<OldKey extends keyof T, NewKey extends string, T extends Record<string, unknown>>(
    oldKey: OldKey,
    newKey: NewKey,
    userObject: T
  ): Record<NewKey, T[OldKey]> & Omit<T, OldKey> {
    const { [oldKey]: value, ...common } = userObject

    return {
      ...common,
      ...({ [newKey]: value } as Record<NewKey, T[OldKey]>),
    }
  }
}
