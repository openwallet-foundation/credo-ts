import type { Validate } from 'class-validator'

import { instanceToPlain, plainToInstance, instanceToInstance } from 'class-transformer'

import { ClassValidationError } from '../error/ClassValidationError'

import { MessageValidator } from './MessageValidator'

interface Validate {
  validate?: boolean
}

export class JsonTransformer {
  public static toJSON<T>(classInstance: T) {
    return instanceToPlain(classInstance, {
      exposeDefaultValues: true,
    })
  }

  public static fromJSON<T>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    return JSON.stringify(this.toJSON(classInstance))
  }

  public static deserialize<T>(
    jsonString: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cls: { new (...args: any[]): T },
    { validate = true }: Validate = {}
  ): T {
    return this.fromJSON(JSON.parse(jsonString), cls, { validate })
  }
}
