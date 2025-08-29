import { Transform, TransformationType } from 'class-transformer'
import { IsOptional, IsString, isInstance } from 'class-validator'
import { CredoError } from '../../../../error'

export interface W3cV2TermsOfUseOptions {
  type: string
  [property: string]: unknown
}

/**
 * Represents a terms of use.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/#terms-of-use
 */
export class W3cV2TermsOfUse {
  public constructor(options: W3cV2TermsOfUseOptions) {
    if (options) {
      const { type, ...properties } = options

      this.type = type
      this.properties = properties
    }
  }

  @IsString()
  public type!: string

  @IsOptional()
  public properties?: Record<string, unknown>
}

const jsonToClass = (v: unknown) => {
  if (!v || typeof v !== 'object') {
    throw new CredoError('Invalid plain W3cV2CredentialTermsOfUse')
  }

  if (isInstance(v, W3cV2TermsOfUse)) {
    return v
  }

  return new W3cV2TermsOfUse(v as W3cV2TermsOfUseOptions)
}

const classToJson = (v: unknown) => {
  if (v instanceof W3cV2TermsOfUse) {
    return { ...v.properties, type: v.type }
  }

  return v
}

export function W3cV2TermsOfUseTransformer() {
  return Transform(({ value, type }: { value: W3cV2TermsOfUseOptions; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (Array.isArray(value) && value.length === 0) {
        throw new CredoError('At least one terms of use is required')
      }

      return Array.isArray(value) ? value.map(jsonToClass) : jsonToClass(value)
    }

    if (type === TransformationType.CLASS_TO_PLAIN) {
      return Array.isArray(value) ? value.map(classToJson) : classToJson(value)
    }

    // PLAIN_TO_PLAIN
    return value
  })
}
