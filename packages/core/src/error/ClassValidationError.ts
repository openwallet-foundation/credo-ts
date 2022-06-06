import type { ValidationError } from 'class-validator'

import { AriesFrameworkError } from './AriesFrameworkError'

export class ClassValidationError extends AriesFrameworkError {
  public validationErrors?: ValidationError[] | undefined

  public constructor(
    message: string,
    { classType, cause, validationErrors }: { classType: string; cause?: Error; validationErrors?: ValidationError[] }
  ) {
    super(`${classType}: ${message}`, { cause })
    this.validationErrors = validationErrors
  }
}
