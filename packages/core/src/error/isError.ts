export function isError(error: unknown): error is Error {
  return error instanceof Error
}

export function errorMessageOr(error: unknown, fallback: string): string {
  return isError(error) ? error.message : fallback
}
