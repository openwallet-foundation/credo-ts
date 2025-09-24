import type { ValidationOptions } from 'class-validator'

import { ValidateBy, buildMessage, isString, isURL } from 'class-validator'
import { isJsonObject } from '../../types'
import { CREDENTIALS_CONTEXT_V1_URL, VERIFIABLE_CREDENTIAL_TYPE, VERIFIABLE_PRESENTATION_TYPE } from './constants'

export interface IsCredentialJsonLdContextValidationOptions extends ValidationOptions {
  /**
   * Whether to allow string value in addition to arrays.
   *
   * @default false
   */
  allowString?: boolean

  /**
   * The expected credential context URL.
   *
   * @default {@link CREDENTIALS_CONTEXT_V1_URL}
   */
  credentialContext?: string
}

export function IsCredentialJsonLdContext(
  validationOptions?: IsCredentialJsonLdContextValidationOptions
): PropertyDecorator {
  const allowString = validationOptions?.allowString ?? false
  const credentialContext = validationOptions?.credentialContext ?? CREDENTIALS_CONTEXT_V1_URL

  return ValidateBy(
    {
      name: 'IsCredentialJsonLdContext',
      validator: {
        validate: (value): boolean => {
          if (!Array.isArray(value)) return allowString && isString(value) && value === credentialContext

          // First item must be the verifiable credential context
          if (value[0] !== credentialContext) return false

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

export function IsCredentialType(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsVerifiableCredentialType',
      validator: {
        validate: (value): boolean => {
          return Array.isArray(value)
            ? value.includes(VERIFIABLE_CREDENTIAL_TYPE) && value.every((v) => typeof v === 'string')
            : value === VERIFIABLE_CREDENTIAL_TYPE
        },
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be "VerifiableCredential" or an array of strings which includes "VerifiableCredential"`,
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
          return Array.isArray(value)
            ? value.includes(VERIFIABLE_PRESENTATION_TYPE) && value.every((v) => typeof v === 'string')
            : value === VERIFIABLE_PRESENTATION_TYPE
        },
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be "VerifiablePresentation" or an array of strings which includes "VerifiablePresentation"`,
          validationOptions
        ),
      },
    },
    validationOptions
  )
}
