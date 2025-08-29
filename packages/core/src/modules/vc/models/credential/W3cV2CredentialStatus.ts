import { Transform, TransformationType } from 'class-transformer'
import { IsOptional, IsString, IsUrl, isInstance } from 'class-validator'
import { CredoError } from '../../../../error'

export interface W3cV2CredentialStatusOptions {
  id?: string
  type: string
  [property: string]: unknown
}

/**
 * Represents a credential status.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/#status
 */
export class W3cV2CredentialStatus {
  public constructor(options: W3cV2CredentialStatusOptions) {
    if (options) {
      const { id, type, ...properties } = options

      this.id = id
      this.type = type
      this.properties = properties
    }
  }

  @IsOptional()
  @IsUrl()
  public id?: string

  @IsString()
  public type!: string

  @IsOptional()
  public properties?: Record<string, unknown>
}

const jsonToClass = (v: unknown) => {
  if (!v || typeof v !== 'object') {
    throw new CredoError('Invalid plain W3cV2CredentialStatus')
  }

  if (isInstance(v, W3cV2CredentialStatus)) {
    return v
  }

  return new W3cV2CredentialStatus(v as W3cV2CredentialStatusOptions)
}

const classToJson = (v: unknown) => {
  if (v instanceof W3cV2CredentialStatus) {
    return { ...v.properties, id: v.id, type: v.type }
  }

  return v
}

export function W3cV2CredentialStatusTransformer() {
  return Transform(({ value, type }: { value: W3cV2CredentialStatusOptions; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      if (Array.isArray(value) && value.length === 0) {
        throw new CredoError('At least one credential status is required')
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
