import { z } from 'zod'

import { formatZodError } from '../utils/zod-error'
import { CredoValidationError } from './CredoValidationError'

export class ZodValidationError extends CredoValidationError {
  public constructor(
    message: string,
    public readonly zodError: z.ZodError
  ) {
    const formattedError = formatZodError(zodError)
    super(`${message}\n${formattedError}`, { cause: zodError })
  }
}
