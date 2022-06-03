import type { Validate } from 'class-validator'

import { instanceToPlain, plainToInstance, instanceToInstance } from 'class-transformer'

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

  public static fromJSON<T>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Class: { new (...args: any[]): T },
    options: Validate = { validate: true }
  ): T {
    if (!options.validate) {
      return plainToInstance(Class, json, { exposeDefaultValues: true })
    } else {
      const plainInstance = plainToInstance(Class, json, { exposeDefaultValues: true })
      //  validateSync is not happy with null/undefined. Return it to keep returning the same as previous versions without validation
      if (plainInstance === undefined || plainInstance === null) {
        return plainInstance
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errors = MessageValidator.validateSync(plainInstance as any)
      // NOTE: validateSync (strangely) return an Array of errors so we
      // have to transform that into an error of choice and throw that.
      if (isValidationErrorArray(errors)) {
        throw new ClassValidationError('Failed to validate class.', {
          recordType: typeof Class,
          cause: new Error(JSON.stringify(errors)),
        })
      } else if (errors.length !== 0) {
        throw new ClassValidationError('An unknown validation error occurred.', { recordType: typeof Class })
      } else {
        return plainInstance as T
      }
    }
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
    Class: { new (...args: any[]): T },
    options?: Validate
  ): T {
    return this.fromJSON(JSON.parse(jsonString), Class, options)
  }
}
