import { validateSync } from 'class-validator'

import { ClassValidationError } from '../error'
import { isValidationErrorArray } from '../error/ValidationErrorUtils'
import { getEncodingSchema, zEncodeWithErrorHandling } from './zod'

// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
export class MessageValidator {
  /**
   *
   * @param classInstance the class instance to validate
   * @returns void
   * @throws array of validation errors {@link ValidationError}
   * @throws {ZodValidationError} if the class has an `encodingSchema` and the instance is not valid
   */
  public static validateSync<T extends object>(classInstance: T & {}) {
    // A class with an encoding schema is valid if it can be encoded
    const encodingSchema = getEncodingSchema(classInstance.constructor)
    if (encodingSchema) {
      zEncodeWithErrorHandling(encodingSchema, classInstance, `Failed to validate ${classInstance.constructor.name}`)
      return
    }

    // NOTE: validateSync returns an Array of errors.
    // We have to transform that into an error of choice and throw that.
    const errors = validateSync(classInstance, {
      forbidUnknownValues: false,
    })
    if (isValidationErrorArray(errors)) {
      throw new ClassValidationError('Failed to validate class.', {
        classType: classInstance.constructor.name,
        validationErrors: errors,
      })
    }
    if (errors.length !== 0) {
      throw new ClassValidationError('An unknown validation error occurred.', {
        classType: Object.prototype.constructor(classInstance).name,
      })
    }
  }
}
