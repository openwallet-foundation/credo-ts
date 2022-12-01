import { validateSync } from 'class-validator'

import { ClassValidationError } from '../error'
import { isValidationErrorArray } from '../error/ValidationErrorUtils'

export class MessageValidator {
  /**
   *
   * @param classInstance the class instance to validate
   * @returns void
   * @throws array of validation errors {@link ValidationError}
   */
  // eslint-disable-next-line @typescript-eslint/ban-types
  public static validateSync<T extends object>(classInstance: T & {}) {
    // NOTE: validateSync returns an Array of errors.
    // We have to transform that into an error of choice and throw that.
    const errors = validateSync(classInstance)
    if (isValidationErrorArray(errors)) {
      throw new ClassValidationError('Failed to validate class.', {
        classType: classInstance.constructor.name,
        validationErrors: errors,
      })
    } else if (errors.length !== 0) {
      throw new ClassValidationError('An unknown validation error occurred.', {
        classType: Object.prototype.constructor(classInstance).name,
      })
    }
  }
}
