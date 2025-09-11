import {
  Transform,
  TransformationType,
  instanceToPlain,
  plainToClassFromExist,
  plainToInstance,
} from 'class-transformer'
import type { ValidationOptions } from 'class-validator'
import { ValidateBy, buildMessage, isInstance, isString } from 'class-validator'
import { IsUri, isUri } from '../../../../utils'

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
      const { id, ...rest } = options

      plainToClassFromExist(this, rest)

      this.id = id
    }
  }

  @IsUri()
  public id!: string;

  [property: string]: unknown
}

export function W3cV2HolderTransformer() {
  return Transform(({ value, type }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (isString(value)) return value
      return plainToInstance(W3cV2Holder, value)
    }

    if (type === TransformationType.CLASS_TO_PLAIN) {
      if (isString(value)) return value
      return instanceToPlain(value)
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
          return (typeof value === 'string' && isUri(value)) || (isInstance(value, W3cV2Holder) && isUri(value.id))
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
