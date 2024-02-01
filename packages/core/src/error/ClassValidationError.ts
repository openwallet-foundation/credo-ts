import type { ValidationError } from 'class-validator'

import { CredoError } from './CredoError'

export class ClassValidationError extends CredoError {
  public validationErrors: ValidationError[]

  public validationErrorsToString() {
    return this.validationErrors?.map((error) => error.toString(true)).join('\n') ?? ''
  }

  public constructor(
    message: string,
    { classType, cause, validationErrors }: { classType: string; cause?: Error; validationErrors?: ValidationError[] }
  ) {
    const validationErrorsStringified = validationErrors
      ?.map((error) => error.toString(undefined, undefined, undefined, true))
      .join('\n')
    super(
      `${classType}: ${message}
${validationErrorsStringified}`,
      { cause }
    )
    this.validationErrors = validationErrors ?? []
  }
}
