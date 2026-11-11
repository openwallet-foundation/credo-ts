import { z } from 'zod'

import { ClassValidationError } from '../ClassValidationError'
import { CredoValidationError } from '../CredoValidationError'
import { ZodValidationError } from '../ZodValidationError'

describe('CredoValidationError', () => {
  it('is the base class of ClassValidationError and ZodValidationError', () => {
    const zodError = z.string().safeParse(1).error as z.ZodError

    expect(new ClassValidationError('Invalid', { classType: 'Test' })).toBeInstanceOf(CredoValidationError)
    expect(new ZodValidationError('Invalid', zodError)).toBeInstanceOf(CredoValidationError)
  })

  it('ZodValidationError has the zod error as cause', () => {
    const zodError = z.string().safeParse(1).error as z.ZodError

    expect(new ZodValidationError('Invalid', zodError).cause).toBe(zodError)
  })
})
