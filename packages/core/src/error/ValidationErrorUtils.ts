import { ValidationError } from 'class-validator'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isValidationErrorArray(e: any): boolean {
  if (Array.isArray(e)) {
    const isErrorArray =
      e.length > 0 &&
      e.every((err) => {
        return err instanceof ValidationError
      })
    return isErrorArray
  }
  return false
}
