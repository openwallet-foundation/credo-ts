import { instanceToInstance, instanceToPlain, plainToInstance } from 'class-transformer'

import { ClassValidationError } from '../error/ClassValidationError'

import { MessageValidator } from './MessageValidator'

interface Validate {
  validate?: boolean
}

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class JsonTransformer {
  public static toJSON<T>(classInstance: T) {
    return instanceToPlain(classInstance, {
      exposeDefaultValues: true,
    })
  }

  public static fromJSON<T>(
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    json: any,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    cls: { new (...args: any[]): T },
    { validate = true }: Validate = {}
  ): T {
    const instance = plainToInstance(cls, json, { exposeDefaultValues: true })

    // Skip validation
    if (!validate) return instance

    if (!instance) {
      throw new ClassValidationError('Cannot validate instance of ', { classType: Object.getPrototypeOf(cls).name })
    }
    MessageValidator.validateSync(instance)

    return instance
  }

  public static clone<T>(classInstance: T): T {
    return instanceToInstance(classInstance, {
      exposeDefaultValues: true,
      enableCircularCheck: true,
      enableImplicitConversion: true,
      ignoreDecorators: true,
    })
  }

  public static serialize<T>(classInstance: T): string {
    return JSON.stringify(JsonTransformer.toJSON(classInstance))
  }

  public static deserialize<T>(
    jsonString: string,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    cls: { new (...args: any[]): T },
    { validate = true }: Validate = {}
  ): T {
    return JsonTransformer.fromJSON(JSON.parse(jsonString), cls, { validate })
  }
}
