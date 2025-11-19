import {
  instanceToPlain,
  plainToClassFromExist,
  plainToInstance,
  Transform,
  TransformationType,
} from 'class-transformer'
import type { ValidationOptions } from 'class-validator'
import { buildMessage, isInstance, isString, ValidateBy } from 'class-validator'
import { IsUri, isUri } from '../../../../utils'

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
      const { id, ...rest } = options

      plainToClassFromExist(this, rest)

      this.id = id
    }
  }

  @IsUri()
  public id!: string;

  [property: string]: unknown
}

export function W3cV2IssuerTransformer() {
  return Transform(({ value, type }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (isString(value)) return value
      return plainToInstance(W3cV2Issuer, value)
    }

    if (type === TransformationType.CLASS_TO_PLAIN) {
      if (isString(value)) return value
      return instanceToPlain(value)
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
          return (typeof value === 'string' && isUri(value)) || (isInstance(value, W3cV2Issuer) && isUri(value.id))
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
