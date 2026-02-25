import type { ValidationOptions } from 'class-validator'

import { buildMessage, ValidateBy } from 'class-validator'

/**
 * Checks if a given value is a Map
 */
export function IsMap(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isMap',
      validator: {
        validate: (value: unknown): boolean => value instanceof Map,
        defaultMessage: buildMessage((eachPrefix) => `${eachPrefix}$property must be a Map`, validationOptions),
      },
    },
    validationOptions
  )
}
