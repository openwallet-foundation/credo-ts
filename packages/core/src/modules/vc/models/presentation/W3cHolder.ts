import type { ValidationOptions } from 'class-validator'

import { Transform, TransformationType, instanceToPlain, plainToInstance } from 'class-transformer'
import { ValidateBy, buildMessage, isInstance, isString } from 'class-validator'

import { IsUri, isUri } from '../../../../utils/validators'

/**
 * TODO: check how to support arbitrary data in class
 */
export interface W3cHolderOptions {
  id: string
}

export class W3cHolder {
  public constructor(options: W3cHolderOptions) {
    if (options) {
      this.id = options.id
    }
  }

  @IsUri()
  public id!: string
}

// Custom transformers
export function W3cHolderTransformer() {
  return Transform(({ value, type }: { value: string | W3cHolderOptions; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (isString(value)) return value
      return plainToInstance(W3cHolder, value)
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

export function IsW3cHolder(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsW3cHolder',
      validator: {
        validate: (value): boolean => {
          if (typeof value === 'string') {
            return isUri(value)
          }
          if (isInstance(value, W3cHolder)) {
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
