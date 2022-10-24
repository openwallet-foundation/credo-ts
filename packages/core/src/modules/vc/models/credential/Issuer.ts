import type { ValidationOptions } from 'class-validator'

import { Transform, TransformationType, plainToInstance, instanceToPlain } from 'class-transformer'
import { buildMessage, isInstance, isString, ValidateBy } from 'class-validator'

import { IsUri, UriValidator } from '../../../../utils/validators'

/**
 * TODO: check how to support arbitrary data in class
 * @see https://www.w3.org/TR/vc-data-model/#credential-subject
 */

export interface IssuerOptions {
  id: string
}

export class Issuer {
  public constructor(options: IssuerOptions) {
    if (options) {
      this.id = options.id
    }
  }

  @IsUri()
  public id!: string
}

// Custom transformers

export function IssuerTransformer() {
  return Transform(({ value, type }: { value: string | IssuerOptions; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (isString(value)) return value
      return plainToInstance(Issuer, value)
    } else if (type === TransformationType.CLASS_TO_PLAIN) {
      if (isString(value)) return value
      return instanceToPlain(value)
    }
    // PLAIN_TO_PLAIN
    return value
  })
}

// Custom validators

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
