import type { Constructor } from './mixins'
import type { ValidationOptions } from 'class-validator'

import { isString, ValidateBy, isInstance, buildMessage } from 'class-validator'

/**
 * Checks if the value is an instance of the specified object.
 */
export function IsStringOrInstance(targetType: Constructor, validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isStringOrVerificationMethod',
      constraints: [targetType],
      validator: {
        validate: (value, args): boolean => isString(value) || isInstance(value, args?.constraints[0]),
        defaultMessage: buildMessage((eachPrefix, args) => {
          if (args?.constraints[0]) {
            return eachPrefix + `$property must be of type string or instance of ${args.constraints[0].name as string}`
          } else {
            return (
              eachPrefix + `isStringOrVerificationMethod decorator expects and object as value, but got falsy value.`
            )
          }
        }, validationOptions),
      },
    },
    validationOptions
  )
}
