import { instanceToPlain, plainToInstance } from 'class-transformer'

export class JsonTransformer {
  public static toJSON<T>(classInstance: T) {
    return instanceToPlain(classInstance, {
      exposeDefaultValues: true,
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static fromJSON<T>(json: any, Class: { new (...args: any[]): T }): T {
    return plainToInstance(Class, json, { exposeDefaultValues: true })
  }

  public static serialize<T>(classInstance: T): string {
    return JSON.stringify(this.toJSON(classInstance))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static deserialize<T>(jsonString: string, Class: { new (...args: any[]): T }): T {
    return this.fromJSON(JSON.parse(jsonString), Class)
  }
}
