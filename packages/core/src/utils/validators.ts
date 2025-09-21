import type { ValidationOptions } from 'class-validator'
import type { SingleOrArray } from '../types'
import type { Constructor } from './mixins'

import { ValidateBy, buildMessage, isInstance, isString } from 'class-validator'

import { asArray } from './array'

export interface IsInstanceOrArrayOfInstancesValidationOptions extends ValidationOptions {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  classType: SingleOrArray<new (...args: any[]) => any>

  /**
   * Whether to allow empty arrays to pass validation
   * @default false
   */
  allowEmptyArray?: boolean
}

/**
 * Checks if the value is a string or the specified instance
 */
export function IsStringOrInstance(targetType: Constructor, validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsStringOrInstance',
      constraints: [targetType],
      validator: {
        validate: (value, args): boolean => isString(value) || isInstance(value, args?.constraints[0]),
        defaultMessage: buildMessage((eachPrefix, args) => {
          if (args?.constraints[0]) {
            return `${eachPrefix}$property must be of type string or instance of ${args.constraints[0].name as string}`
          }
          return `${eachPrefix}IsStringOrInstance decorator expects an object as value, but got falsy value.`
        }, validationOptions),
      },
    },
    validationOptions
  )
}

export function IsInstanceOrArrayOfInstances(
  validationOptions: IsInstanceOrArrayOfInstancesValidationOptions
): PropertyDecorator {
  const classTypes = asArray(validationOptions.classType)
  const allowEmptyArray = validationOptions.allowEmptyArray ?? false

  return ValidateBy(
    {
      name: 'isInstanceOrArrayOfInstances',
      validator: {
        validate: (values) => {
          if (!values) return false
          if (Array.isArray(values) && values.length === 0) return allowEmptyArray

          return (
            asArray(values)
              // all values MUST be instance of one of the class types
              .every((value) => classTypes.some((classType) => isInstance(value, classType)))
          )
        },
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property value must be an instance of, or an array of instances containing ${classTypes
              .map((c) => c.name)
              .join(', ')}`,
          validationOptions
        ),
      },
    },
    validationOptions
  )
}

export function IsStringOrInstanceOrArrayOfInstances(
  validationOptions: IsInstanceOrArrayOfInstancesValidationOptions
): PropertyDecorator {
  const classTypes = asArray(validationOptions.classType)
  const allowEmptyArray = validationOptions.allowEmptyArray ?? false

  return ValidateBy(
    {
      name: 'IsStringOrInstanceOrArrayOfInstances',
      validator: {
        validate: (values) => {
          if (isString(values)) return true
          if (!values) return false
          if (Array.isArray(values) && values.length === 0) return allowEmptyArray

          return (
            asArray(values)
              // all values MUST be instance of one of the class types
              .every((value) => classTypes.some((classType) => isInstance(value, classType)))
          )
        },
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property value must be a string, an instance of, or an array of instances containing ${classTypes
              .map((c) => c.name)
              .join(', ')}`,
          validationOptions
        ),
      },
    },
    validationOptions
  )
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function isStringArray(value: any): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

export const UriValidator = /\w+:(\/?\/?)[^\s]+/

export function isUri(value: string) {
  return UriValidator.test(value)
}

export function IsUri(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isUri',
      validator: {
        validate: (value): boolean => isUri(value),
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be an URI (that matches regex: ${UriValidator.source})`,
          validationOptions
        ),
      },
    },
    validationOptions
  )
}

export function IsNever(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsNever',
      validator: {
        validate: (values) => typeof values === 'undefined',
        defaultMessage: buildMessage((eachPrefix) => `${eachPrefix}$property is forbidden.`, validationOptions),
      },
    },
    validationOptions
  )
}
