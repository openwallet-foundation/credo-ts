import type { ValidationOptions } from 'class-validator'

import { Transform, TransformationType } from 'class-transformer'
import { IsOptional, IsUrl, ValidateBy, buildMessage, isInstance, isString, isURL } from 'class-validator'
import { CredoError } from '../../../../error'

export interface W3cV2HolderOptions {
  id: string
  [property: string]: unknown
}

/**
 * Represents a credential holder.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/#holder
 */
export class W3cV2Holder {
  public constructor(options: W3cV2HolderOptions) {
    if (options) {
      const { id, ...properties } = options

      this.id = options.id
      this.properties = properties
    }
  }

  @IsUrl()
  public id!: string

  @IsOptional()
  public properties?: Record<string, unknown>
}

export function W3cV2HolderTransformer() {
  return Transform(({ value, type }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (isString(value)) return value
      if (!value || typeof value !== 'object') throw new CredoError('Invalid plain W3cV2Holder')
      return new W3cV2Holder(value)
    }

    if (type === TransformationType.CLASS_TO_PLAIN) {
      if (isString(value)) return value
      if (!(value instanceof W3cV2Holder)) throw new CredoError('Invalid W3cV2Holder')
      return { ...value.properties, id: value.id }
    }

    // PLAIN_TO_PLAIN
    return value
  })
}

export function IsW3cV2Holder(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsW3cV2Holder',
      validator: {
        validate: (value): boolean => {
          return (typeof value === 'string' && isURL(value)) || isInstance(value, W3cV2Holder)
        },
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be an URL or a valid W3cV2Holder instance`,
          validationOptions
        ),
      },
    },
    validationOptions
  )
}
