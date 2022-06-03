import { validateOrReject, validateSync } from 'class-validator'

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
  public static validateSync<T extends object>(classInstance: T) {
    return validateSync(classInstance)
  }
}
