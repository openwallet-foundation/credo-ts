import { classToPlain, deserialize, plainToClass, serialize } from 'class-transformer';
export class JsonTransformer {
  public static toJSON<T>(classInstance: T) {
    return classToPlain(classInstance, {
      exposeDefaultValues: true,
    });
  }

  public static fromJSON<T>(json: Record<string, unknown>, Class: { new (...args: any[]): T }): T {
    return plainToClass(Class, json, { exposeDefaultValues: true });
  }

  public static serialize<T>(classInstance: T): string {
    return serialize(classInstance, {
      exposeDefaultValues: true,
    });
  }

  public static deserialize<T>(jsonString: string, Class: { new (...args: any[]): T }): T {
    return deserialize(Class, jsonString, { exposeDefaultValues: true });
  }
}
