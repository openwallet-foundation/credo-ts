import type { ValidationOptions } from 'class-validator'

import { buildMessage, isString, isURL, ValidateBy } from 'class-validator'

import { isJsonObject } from '../../utils/type'

import { CREDENTIALS_CONTEXT_V1_URL } from './constants'

export function IsJsonLdContext(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsJsonLdContext',
      validator: {
        validate: (value): boolean => {
          // If value is an array, check if all items are strings, are URLs and that
          // the first entry is a verifiable credential context
          if (Array.isArray(value)) {
            return value.every(
              (v) => (isString(v) && isURL(v)) || (isJsonObject(v) && value[0] === CREDENTIALS_CONTEXT_V1_URL)
            )
          }

          // If value is not an array, check if it is an object (assuming it's a JSON-LD context definition)
          if (typeof value === 'object') {
            return true
          }
          return false
        },
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + '$property must be an array of strings or a JSON-LD context definition',
          validationOptions
        ),
      },
    },
    validationOptions
  )
}
