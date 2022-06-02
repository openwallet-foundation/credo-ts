import type { Validate } from 'class-validator'

import { instanceToPlain, plainToInstance } from 'class-transformer'

import { ClassValidationError } from '../error/ClassValidationError'
import { isValidationErrorArray } from '../error/ValidationErrorUtils'

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

  public static async fromJSON<T>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Class: { new (...args: any[]): T },
    { validate = true }: Validate
  ): Promise<T> {
    if (!validate) {
      return plainToInstance(Class, json, { exposeDefaultValues: true })
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plainInstance = plainToInstance(Class, json, { exposeDefaultValues: true }) as any
      try {
        await MessageValidator.validate(plainInstance)
        return plainInstance as T
      } catch (e) {
        if (isValidationErrorArray(e)) {
          throw new ClassValidationError('Failed to validate class.', {
            recordType: typeof Class,
            cause: new Error(JSON.stringify(e)),
          })
        } else {
          throw new ClassValidationError('An unknown validation error occurred.', { recordType: typeof Class })
        }
      }
    }
  }

  public static serialize<T>(classInstance: T): string {
    return JSON.stringify(this.toJSON(classInstance))
  }

  public static async deserialize<T>(
    jsonString: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Class: { new (...args: any[]): T },
    options: Validate
  ): Promise<T> {
    return await this.fromJSON(JSON.parse(jsonString), Class, options)
  }
}
