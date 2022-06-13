import { ValidationError } from 'class-validator'

export function isValidationErrorArray(e: ValidationError[] | unknown): boolean {
  if (Array.isArray(e)) {
    const isErrorArray = e.length > 0 && e.every((err) => err instanceof ValidationError)
    return isErrorArray
  }
  return false
}
