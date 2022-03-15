import type { ValidationOptions } from 'class-validator'

import { isURL, ValidateBy, isString, isInstance, buildMessage } from 'class-validator'

import { UriValidator } from '../../utils/validators'

import { CREDENTIALS_CONTEXT_V1_URL, VERIFIABLE_CREDENTIAL_TYPE, VERIFIABLE_PRESENTATION_TYPE } from './constants'
import { Issuer } from './models/credential/Issuer'

export function IsJsonLdContext(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsJsonLdContext',
      validator: {
        validate: (value): boolean => {
          // If value is an array, check if all items are strings, are URLs and that
          // the first entry is a verifiable credential context
          if (Array.isArray(value)) {
            return value.every((v) => isString(v) && isURL(v)) && value[0] === CREDENTIALS_CONTEXT_V1_URL
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

export function IsVerifiableCredentialType(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsVerifiableCredentialType',
      validator: {
        validate: (value): boolean => {
          if (Array.isArray(value)) {
            return value.includes(VERIFIABLE_CREDENTIAL_TYPE)
          }
          return false
        },
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + '$property must be an array of strings which includes "VerifiableCredential"',
          validationOptions
        ),
      },
    },
    validationOptions
  )
}

export function IsVerifiablePresentationType(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsVerifiablePresentationType',
      validator: {
        validate: (value): boolean => {
          if (Array.isArray(value)) {
            return value.includes(VERIFIABLE_PRESENTATION_TYPE)
          }
          return false
        },
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + '$property must be an array of strings which includes "VerifiablePresentation"',
          validationOptions
        ),
      },
    },
    validationOptions
  )
}

export function IsIssuer(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsIssuer',
      validator: {
        validate: (value): boolean => {
          if (typeof value === 'string') {
            return UriValidator.test(value)
          }
          if (isInstance(value, Issuer)) {
            return UriValidator.test(value.id)
          }
          return false
        },
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + '$property must be a string or an object with an id property',
          validationOptions
        ),
      },
    },
    validationOptions
  )
}
