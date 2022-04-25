import type { ValidationOptions } from 'class-validator'

import { ValidateBy, isInstance, buildMessage } from 'class-validator'

export interface IsInstanceOrArrayOfInstancesValidationOptions extends ValidationOptions {
  classType: new (...args: any[]) => any
}

export function IsInstanceOrArrayOfInstances(
  validationOptions: IsInstanceOrArrayOfInstancesValidationOptions
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isInstanceOrArrayOfInstances',
      validator: {
        validate: (value): boolean => {
          if (Array.isArray(value)) {
            value.forEach((item) => {
              if (!isInstance(item, validationOptions.classType)) {
                return false
              }
            })
            return true
          }
          return isInstance(value, validationOptions.classType)
        },
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + `$property must be a string or instance of ${validationOptions.classType.name}`,
          validationOptions
        ),
      },
    },
    validationOptions
  )
}

export function isStringArray(value: any): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

export const UriValidator = new RegExp('w+:(/?/?)[^s]+')

export function IsUri(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isInstanceOrArrayOfInstances',
      validator: {
        validate: (value): boolean => {
          return UriValidator.test(value)
        },
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + `$property must be a string that matches regex: ${UriValidator.source}`,
          validationOptions
        ),
      },
    },
    validationOptions
  )
}
