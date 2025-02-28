import type { ValidationOptions } from 'class-validator'

import { Transform, TransformationType, instanceToPlain, plainToInstance } from 'class-transformer'
import { ValidateBy, buildMessage, isInstance, isString } from 'class-validator'

import { IsUri, isUri } from '../../../../utils/validators'

/**
 * TODO: check how to support arbitrary data in class
 * @see https://www.w3.org/TR/vc-data-model/#credential-subject
 */

export interface W3cIssuerOptions {
  id: string
}

export class W3cIssuer {
  public constructor(options: W3cIssuerOptions) {
    if (options) {
      this.id = options.id
    }
  }

  @IsUri()
  public id!: string
}

// Custom transformers

export function W3cIssuerTransformer() {
  return Transform(({ value, type }: { value: string | W3cIssuerOptions; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (isString(value)) return value
      return plainToInstance(W3cIssuer, value)
    }
    if (type === TransformationType.CLASS_TO_PLAIN) {
      if (isString(value)) return value
      return instanceToPlain(value)
    }
    // PLAIN_TO_PLAIN
    return value
  })
}

// Custom validators

export function IsW3cIssuer(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsW3cIssuer',
      validator: {
        validate: (value): boolean => {
          if (typeof value === 'string') {
            return isUri(value)
          }
          if (isInstance(value, W3cIssuer)) {
            return isUri(value.id)
          }
          return false
        },
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be an URI or an object with an id property which is an URI`,
          validationOptions
        ),
      },
    },
    validationOptions
  )
}
