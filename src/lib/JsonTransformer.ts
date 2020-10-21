import { classToPlain, deserialize, plainToClass, serialize } from 'class-transformer';
import { ClassType } from 'class-transformer/ClassTransformer';

export class JsonTransformer {
  public static toJSON<T>(classInstance: T) {
    return classToPlain(classInstance);
  }

  public static fromJSON<T>(json: Record<string, unknown>, Class: ClassType<T>): T {
    return plainToClass(Class, json);
  }

  public static serialize<T>(classInstance: T): string {
    return serialize(classInstance);
  }

  public static deserialize<T>(jsonString: string, Class: ClassType<T>): T {
    return deserialize(Class, jsonString);
  }
}
