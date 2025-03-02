import type { ValidationOptions } from 'class-validator'

import { ValidateBy, buildMessage, isString, isURL } from 'class-validator'

import { isJsonObject } from '../../utils'

import { CREDENTIALS_CONTEXT_V1_URL } from './constants'

export function IsCredentialJsonLdContext(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsCredentialJsonLdContext',
      validator: {
        validate: (value): boolean => {
          if (!Array.isArray(value)) return false

          // First item must be the verifiable credential context
          if (value[0] !== CREDENTIALS_CONTEXT_V1_URL) return false

          return value.every((v) => (isString(v) && isURL(v)) || isJsonObject(v))
        },
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be an array of strings or objects, where the first item is the verifiable credential context URL.`,
          validationOptions
        ),
      },
    },
    validationOptions
  )
}
