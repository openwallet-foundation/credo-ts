import { CredoError } from './CredoError'

/**
 * Base class for errors thrown when a value fails validation, with class-validator ({@link ClassValidationError})
 * or a zod schema ({@link ZodValidationError}).
 */
export class CredoValidationError extends CredoError {}
