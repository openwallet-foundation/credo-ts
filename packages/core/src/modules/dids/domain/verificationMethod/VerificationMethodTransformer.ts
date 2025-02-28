import type { ValidationOptions } from 'class-validator'

import { Transform, TransformationType } from 'class-transformer'
import { ValidateBy, buildMessage, isInstance, isString } from 'class-validator'

import { JsonTransformer } from '../../../../utils/JsonTransformer'

import { VerificationMethod } from './VerificationMethod'

/**
 * Checks if a given value is a real string.
 */
function IsStringOrVerificationMethod(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isStringOrVerificationMethod',
      validator: {
        validate: (value): boolean => isString(value) || isInstance(value, VerificationMethod),
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be a string or instance of VerificationMethod`,
          validationOptions
        ),
      },
    },
    validationOptions
  )
}

/**
 * Decorator that transforms authentication json to corresponding class instances
 *
 * @example
 * class Example {
 *   VerificationMethodTransformer()
 *   private authentication: VerificationMethod
 * }
 */
function VerificationMethodTransformer() {
  return Transform(({ value, type }: { value?: Array<string | { type: string }>; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      return value?.map((auth) => {
        // referenced verification method
        if (typeof auth === 'string') {
          return String(auth)
        }

        // embedded verification method
        return JsonTransformer.fromJSON(auth, VerificationMethod)
      })
    }
    if (type === TransformationType.CLASS_TO_PLAIN) {
      return value?.map((auth) => (typeof auth === 'string' ? auth : JsonTransformer.toJSON(auth)))
    }

    // PLAIN_TO_PLAIN
    return value
  })
}

export { IsStringOrVerificationMethod, VerificationMethodTransformer }
