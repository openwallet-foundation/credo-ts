import { z } from 'zod'

import { CredoError } from './CredoError'

export class ZodValidationError extends CredoError {
  public constructor(message: string, public readonly zodError: z.ZodError) {
    const errorDetails = JSON.stringify(zodError.flatten(), null, 2)
    super(`${message}\n${errorDetails}`)
  }
}
