import type { ValidationOptions } from 'class-validator'

import { Transform, TransformationType } from 'class-transformer'
import { IsOptional, IsUrl, ValidateBy, buildMessage, isInstance, isString, isURL } from 'class-validator'
import { CredoError } from '../../../../error'

export interface W3cV2IssuerOptions {
  id: string
  [property: string]: unknown
}

/**
 * Represents a credential issuer.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/#issuer
 */
export class W3cV2Issuer {
  public constructor(options: W3cV2IssuerOptions) {
    if (options) {
      const { id, ...properties } = options

      this.id = id
      this.properties = properties
    }
  }

  @IsUrl()
  public id!: string

  @IsOptional()
  public properties?: Record<string, unknown>
}

export function W3cV2IssuerTransformer() {
  return Transform(({ value, type }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (isString(value)) return value
      if (!value || typeof value !== 'object') throw new CredoError('Invalid plain W3cV2Issuer')
      return new W3cV2Issuer(value)
    }

    if (type === TransformationType.CLASS_TO_PLAIN) {
      if (isString(value)) return value
      if (!(value instanceof W3cV2Issuer)) throw new CredoError('Invalid W3cV2Issuer')
      return { ...value.properties, id: value.id }
    }

    // PLAIN_TO_PLAIN
    return value
  })
}

export function IsW3cV2Issuer(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsW3cV2Issuer',
      validator: {
        validate: (value): boolean => {
          return (typeof value === 'string' && isURL(value)) || isInstance(value, W3cV2Issuer)
        },
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be an URL or a valid W3cV2Issuer instance`,
          validationOptions
        ),
      },
    },
    validationOptions
  )
}
