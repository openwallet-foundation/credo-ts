import { validateOrReject, validateSync } from 'class-validator'

import { ClassValidationError } from '../error'
import { isValidationErrorArray } from '../error/ValidationErrorUtils'

export class MessageValidator {
  /**
   *
   * @param classInstance the class instance to validate
   * @returns nothing
   * @throws array of validation errors {@link ValidationError}
   */
  // eslint-disable-next-line @typescript-eslint/ban-types
  public static validate<T extends object>(classInstance: T) {
    return validateOrReject(classInstance)
  }
  // eslint-disable-next-line @typescript-eslint/ban-types
  public static validateSync<T extends object>(
    // eslint-disable-next-line @typescript-eslint/ban-types
    classInstance: T & {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cls: { new (...args: any[]): T }
  ) {
    // NOTE: validateSync (strangely) return an Array of errors so we
    // have to transform that into an error of choice and throw that.
    const errors = validateSync(classInstance)
    if (isValidationErrorArray(errors)) {
      throw new ClassValidationError('Failed to validate class.', {
        classType: Object.getPrototypeOf(cls).name,
        validationErrors: errors,
      })
    } else if (errors.length !== 0) {
      throw new ClassValidationError('An unknown validation error occurred.', {
        classType: Object.prototype.constructor(cls).name,
      })
    }
    return errors
  }
}
