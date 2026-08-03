import type { ValidationOptions } from 'class-validator'

import { buildMessage, isRFC3339, isString, isURL, ValidateBy } from 'class-validator'
import { isJsonObject, type JsonObject, type SingleOrArray } from '../../types'
import { asArray } from '../../utils/array'
import { VERIFIABLE_CREDENTIAL_TYPE, VERIFIABLE_PRESENTATION_TYPE } from './constants'
import {
  DEFAULT_CREDENTIAL_CONTEXTS,
  getCredentialContextVersion,
  type W3cCredentialDataModelVersion,
} from './credentialContextVersion'

export interface IsCredentialJsonLdContextValidationOptions extends ValidationOptions {
  /**
   * Whether to allow string value in addition to arrays.
   *
   * @default false
   */
  allowString?: boolean

  /**
   * The credential context URL(s) that are accepted as the first entry of the context.
   *
   * @default [{@link CREDENTIALS_CONTEXT_V1_URL}, {@link CREDENTIALS_CONTEXT_V2_URL}]
   */
  credentialContext?: SingleOrArray<string>
}

export function IsCredentialJsonLdContext(
  validationOptions?: IsCredentialJsonLdContextValidationOptions
): PropertyDecorator {
  const allowString = validationOptions?.allowString ?? false
  const credentialContexts = validationOptions?.credentialContext
    ? asArray(validationOptions.credentialContext)
    : DEFAULT_CREDENTIAL_CONTEXTS

  return ValidateBy(
    {
      name: 'IsCredentialJsonLdContext',
      validator: {
        validate: (value): boolean => {
          if (!Array.isArray(value)) return allowString && isString(value) && credentialContexts.includes(value)

          // First item must be one of the accepted verifiable credential contexts
          if (!credentialContexts.includes(value[0])) return false

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

export interface IsW3cCredentialDateValidationOptions extends ValidationOptions {
  /**
   * The data model version this property belongs to. The property must be undefined when the
   * credential uses a different data model version, as the term is not defined by that context.
   */
  dataModelVersion: W3cCredentialDataModelVersion

  /**
   * Whether the property is required when the credential uses {@link dataModelVersion}.
   *
   * @default false
   */
  required?: boolean
}

/**
 * Validates a credential date property (`issuanceDate`, `expirationDate`, `validFrom`, `validUntil`)
 * against the data model version indicated by the credential `@context`.
 *
 * Terms are only defined by the context of the data model version that introduced them, so a
 * property belonging to a different version must be absent.
 */
export function IsW3cCredentialDate(options: IsW3cCredentialDateValidationOptions): PropertyDecorator {
  const { dataModelVersion, required = false } = options

  return ValidateBy(
    {
      name: 'IsW3cCredentialDate',
      validator: {
        validate: (value, args): boolean => {
          const context = (args?.object as { context?: string | Array<string | JsonObject> })?.context
          const version = getCredentialContextVersion(context)

          // The context itself is invalid, and reported by IsCredentialJsonLdContext. Only assert
          // the value is a valid date so we don't report a confusing data model mismatch.
          if (version === undefined) return value === undefined || isRFC3339(value)

          if (version !== dataModelVersion) return value === undefined
          if (value === undefined) return !required

          return isRFC3339(value)
        },
        defaultMessage: buildMessage((eachPrefix) => {
          const other = dataModelVersion === '1.1' ? '2.0' : '1.1'
          return `${eachPrefix}$property is only defined by the Verifiable Credentials Data Model ${dataModelVersion} context and must be ${
            required ? 'a valid RFC 3339 date' : 'undefined or a valid RFC 3339 date'
          }, and undefined when the credential uses the data model ${other} context.`
        }, options),
      },
    },
    options
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
