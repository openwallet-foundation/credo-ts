import {
  Expose,
  Transform,
  TransformationType,
  instanceToPlain,
  plainToClassFromExist,
  plainToInstance,
} from 'class-transformer'
import { IsEnum, IsOptional, IsString, isString } from 'class-validator'

export interface W3cV2LocalizedValueOptions {
  value: string
  language?: string | null
  direction?: 'ltr' | 'rtl' | null
  [property: string]: unknown
}

/**
 * Represents a localized string.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/#internationalization-considerations
 */
export class W3cV2LocalizedValue {
  public constructor(options: W3cV2LocalizedValueOptions) {
    if (options) {
      const { value, language, direction, ...rest } = options

      plainToClassFromExist(this, rest)

      this.value = value
      this.language = language
      this.direction = direction
    }
  }

  @Expose({ name: '@value' })
  @IsString()
  public value!: string

  @Expose({ name: '@language' })
  @IsOptional()
  @IsString()
  public language?: string | null

  @Expose({ name: '@direction' })
  @IsOptional()
  @IsEnum(['ltr', 'rtl', null])
  public direction?: 'ltr' | 'rtl' | null;

  [property: string]: unknown
}

export function W3cV2LocalizedValueTransformer() {
  return Transform(({ value, type }: { value: string | W3cV2LocalizedValueOptions; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (isString(value)) {
        return value
      }

      if (Array.isArray(value)) {
        return value.map((v) => plainToInstance(W3cV2LocalizedValue, v))
      }

      return plainToInstance(W3cV2LocalizedValue, value)
    }

    if (type === TransformationType.CLASS_TO_PLAIN) {
      if (isString(value)) {
        return value
      }

      if (Array.isArray(value)) {
        return value.map((v) => instanceToPlain(W3cV2LocalizedValue, v))
      }

      return instanceToPlain(value)
    }

    // PLAIN_TO_PLAIN
    return value
  })
}
