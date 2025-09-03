import type { ValidationOptions } from 'class-validator'

import { Transform, TransformationType, instanceToPlain, plainToInstance } from 'class-transformer'
import { IsUrl, ValidateBy, buildMessage, isInstance, isString, isURL } from 'class-validator'

export interface W3cV2IssuerOptions {
  id: string
}

/**
 * Represents a credential issuer.
 *
 * TODO: figure out how to retain arbitrary properties and make them accessible in the class.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/#issuer
 */
export class W3cV2Issuer {
  public constructor(options: W3cV2IssuerOptions) {
    if (options) {
      this.id = options.id
    }
  }

  @IsUrl()
  public id!: string
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
