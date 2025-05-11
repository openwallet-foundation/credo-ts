import { z } from 'zod'

import { formatZodError } from '../utils/zod-error'
import { CredoError } from './CredoError'

export class ZodValidationError extends CredoError {
  public constructor(
    message: string,
    public readonly zodError: z.ZodError
  ) {
    const formattedError = formatZodError(zodError)
    super(`${message}\n${formattedError}`)
  }
}
