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
}
